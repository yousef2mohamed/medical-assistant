import os
import json
import asyncio
import httpx
from datetime import date
from fastapi import (FastAPI, UploadFile, File, Form, HTTPException,
                     Depends, Header, Request)
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types
from prompts import PROMPTS

load_dotenv()

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options=types.HttpOptions(timeout=60000),  # 60 ثانية
)
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
FALLBACK = os.getenv("GEMINI_FALLBACK_MODEL", "")
SB_URL = os.environ["SUPABASE_URL"].rstrip("/")
SB_ANON = os.environ["SUPABASE_ANON_KEY"]
SB_SERVICE = os.environ["SUPABASE_SERVICE_KEY"]
DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "30"))
GUEST_LIMIT = int(os.getenv("GUEST_DAILY_LIMIT", "10"))
MAX_FILES = int(os.getenv("MAX_FILES", "5"))
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "10"))
MAX_FILE = 10 * 1024 * 1024
MAX_TOTAL = 25 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "application/pdf"}
AUDIO_TYPES = {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3",
               "audio/ogg", "audio/flac", "audio/aac"}

# عدّاد الزوار (في الذاكرة): (IP, التاريخ) -> عدد الطلبات
guest_usage: dict = {}

app = FastAPI()

origins = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


async def identify(request: Request, authorization: str = Header(None)):
    """مستخدم مسجّل (Token صحيح) أو زائر (من غير Authorization)."""
    if authorization is None:
        ip = request.client.host if request.client else "unknown"
        return {"guest": True, "id": ip}
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "سجّل دخول الأول")
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            f"{SB_URL}/auth/v1/user",
            headers={"apikey": SB_ANON, "Authorization": authorization},
        )
    if r.status_code != 200:
        raise HTTPException(401, "الجلسة منتهية، سجّل دخول تاني")
    return {"guest": False, "id": r.json()["id"]}


def service_headers():
    # المفاتيح الجديدة (sb_secret_...) مش JWT فبتتبعت في apikey بس
    if SB_SERVICE.startswith("sb_"):
        return {"apikey": SB_SERVICE}
    return {"apikey": SB_SERVICE, "Authorization": f"Bearer {SB_SERVICE}"}


async def check_limit(who: dict):
    if who["guest"]:
        today = date.today()
        for k in [k for k in guest_usage if k[1] != today]:
            del guest_usage[k]
        key = (who["id"], today)
        guest_usage[key] = guest_usage.get(key, 0) + 1
        if guest_usage[key] > GUEST_LIMIT:
            raise HTTPException(429, "وصلت للحد اليومي للزوار، سجّل دخول للمتابعة")
        return

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.post(
            f"{SB_URL}/rest/v1/rpc/increment_usage",
            headers=service_headers(),
            json={"p_user": who["id"]},
        )
    if r.status_code != 200:
        raise HTTPException(500, "خطأ في عداد الاستخدام، اتأكد من تشغيل schema.sql")
    if r.json() > DAILY_LIMIT:
        raise HTTPException(429, "وصلت للحد اليومي، جرّب بكرة")


async def generate(parts, system_instruction=None):
    """بيجرّب الموديل الأساسي 3 مرات ثم الاحتياطي، ويرجّع النص."""
    for m in [MODEL] + ([FALLBACK] if FALLBACK else []):
        for attempt in range(3):
            try:
                response = await run_in_threadpool(
                    client.models.generate_content,
                    model=m,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction),
                )
                if response.text:
                    return response.text
            except Exception as e:
                print(f"Gemini error ({m}, try {attempt + 1}):", e)
                await asyncio.sleep(2 * (attempt + 1))
    raise HTTPException(503, "الذكاء الاصطناعي مشغول حاليًا، جرّب بعد دقيقة")


def build_contents(history_json: str, question: str, file_parts: list):
    """بيبني المحادثة: الرسائل السابقة (نص) + السؤال الحالي مع ملفاته."""
    try:
        history = json.loads(history_json or "[]")
        if not isinstance(history, list):
            history = []
    except Exception:
        history = []

    contents = []
    for h in history[-MAX_HISTORY:]:
        if not isinstance(h, dict):
            continue
        text = str(h.get("text", ""))[:4000].strip()
        if not text:
            continue
        role = "user" if h.get("role") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

    # المحادثة لازم تبدأ برسالة من المستخدم
    while contents and contents[0].role != "user":
        contents.pop(0)

    contents.append(types.Content(
        role="user", parts=[types.Part(text=question), *file_parts]))
    return contents


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(
    mode: str = Form(...),
    question: str = Form(...),
    history: str = Form("[]"),
    files: list[UploadFile] | None = File(None),
    who: dict = Depends(identify),
):
    if mode not in PROMPTS:
        raise HTTPException(400, "نوع الطلب غير صحيح")

    files = files or []
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"أقصى عدد ملفات {MAX_FILES}")

    file_parts = []
    total = 0
    for f in files:
        if f.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, "نوع الملف غير مدعوم (png / jpg / webp / pdf)")
        data = await f.read()
        total += len(data)
        if len(data) > MAX_FILE:
            raise HTTPException(400, "الملف أكبر من 10MB")
        if total > MAX_TOTAL:
            raise HTTPException(400, "حجم الملفات مجتمعة أكبر من 25MB")
        file_parts.append(types.Part.from_bytes(data=data, mime_type=f.content_type))

    await check_limit(who)
    text = await generate(
        build_contents(history, question, file_parts), PROMPTS[mode])
    return {"answer": text}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    who: dict = Depends(identify),
):
    if file.content_type not in AUDIO_TYPES:
        raise HTTPException(400, "نوع الملف الصوتي غير مدعوم")
    data = await file.read()
    if len(data) > MAX_FILE:
        raise HTTPException(400, "التسجيل أكبر من 10MB")

    await check_limit(who)

    prompt = ("اكتب بالظبط الكلام المسجل في الملف الصوتي كنص، بنفس لغة المتكلم "
              "(غالبًا عربي مصري). متضيفش أي شرح أو تعليق. "
              "لو مفيش كلام مفهوم اكتب فقط: [لا يوجد كلام]")
    text = await generate(
        [prompt, types.Part.from_bytes(data=data, mime_type=file.content_type)])
    text = text.strip()
    if text == "[لا يوجد كلام]":
        text = ""
    return {"text": text}
