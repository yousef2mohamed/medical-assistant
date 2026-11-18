# المساعد الطبي الذكي — خطوات التشغيل

## 1) Supabase
1. سجّل على supabase.com ← New project.
2. SQL Editor ← New query ← الصق محتوى `supabase/schema.sql` ← Run.
3. Authentication ← Providers ← Email ← قفّل "Confirm email".
4. Project Settings ← API ← انسخ: Project URL و anon key و service_role key.

## 2) Gemini
aistudio.google.com ← Get API key ← Create API key.

## 3) ملفات .env
- `backend/.env.example` ← انسخه باسم `backend/.env` واملاه.
- `frontend/.env.example` ← انسخه باسم `frontend/.env` واملاه.

## 4) تشغيل الباك إند
cd backend
python -m venv venv
venv\Scripts\activate        (ماك/لينكس: source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload

## 5) تشغيل الواجهة (Terminal تاني)
cd frontend
npm install
npm run dev
ثم افتح http://localhost:5173
