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
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Если таблица уже была создана без поля comment, добавляем его:
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS comment TEXT;

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
