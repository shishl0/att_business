-- Добавляем баланс сотрудника
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- Добавляем фиксированную зарплату в расписание
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS shift_salary NUMERIC DEFAULT 0;

-- Создаем таблицу транзакций (движение депозита)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('accrual', 'withdrawal')),
    comment TEXT,
    source TEXT DEFAULT 'system',
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Если таблица уже была создана без поля comment или source, добавляем их:
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS comment TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'system';

-- Добавляем типы событий для перерыва
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'break_start';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'break_end';

-- Добавляем комментарий к логам посещаемости (например, причина ухода)
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS comment TEXT;

-- Обновляем RLS (если нужно)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role only" ON public.transactions FOR ALL USING (true);


-- Создаем таблицу настроек
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Устанавливаем базовый IP (если нужно по умолчанию разрешить все, можно использовать .*)
INSERT INTO public.settings (key, value) VALUES ('allowed_ips', '.*') ON CONFLICT (key) DO NOTHING;

-- Базовые настройки для учета опозданий
INSERT INTO public.settings (key, value) VALUES ('late_grace_mins', '15') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.settings (key, value) VALUES ('late_penalty_kzt', '1000') ON CONFLICT (key) DO NOTHING;
