-- Таблица сотрудников
CREATE TABLE public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    device_id TEXT UNIQUE, -- Fingerprint устройства
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enum для типа активности
CREATE TYPE public.event_type AS ENUM ('check_in', 'check_out');

-- Таблица логов посещаемости
CREATE TABLE public.attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    type event_type NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Устанавливаем политики Row Level Security (RLS) для защиты, хотя мы будем использовать service role в Server Actions
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Создаем базовую политику, чтобы можно было хотя бы читать через anon, если понадобится,
-- но в идеале доступ идет только через Server Actions.
-- CREATE POLICY "Allow public read access" ON public.employees FOR READ USING (true);
