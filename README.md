# CentrasFlow AI

CentrasFlow AI — это инновационная Kanban-система с встроенным искусственным интеллектом для управления проектами и задачами Centras Group.

## Переменные окружения (Environment Variables)

Для запуска проекта вам необходимо создать файл `.env` (или настроить переменные в вашей CI/CD системе/Railway) со следующими значениями:

*   **DATABASE_URL**: Строка подключения к базе данных PostgreSQL (Supabase).
*   **SUPABASE_URL**: URL вашего проекта Supabase.
*   **SUPABASE_ANON_KEY**: Публичный анонимный ключ API Supabase.
*   **SUPABASE_SERVICE_ROLE_KEY**: Секретный ключ сервисной роли Supabase (для административных задач).
*   **GEMINI_API_KEY**: API ключ от Google Gemini (для работы AI функций).
*   **JWT_SECRET**: Секретный ключ для подписи JWT токенов (обычно предоставляется Supabase).

Пример файла находится в `.env.example`.

## Структура проекта

*   `supabase/migrations`: SQL файлы миграций базы данных.
*   `supabase/functions`: Edge Functions (Deno) для серверной логики (AI интеграция).
*   `.github/workflows`: Конфигурация CI/CD для GitHub Actions.
*   `railway.json`: Конфигурация для развертывания в Railway.

## Запуск и развертывание

### Локальная разработка (Supabase CLI)

1.  Установите [Supabase CLI](https://supabase.com/docs/guides/cli).
2.  Запустите Supabase локально:
    ```bash
    supabase start
    ```
3.  Разверните функции:
    ```bash
    supabase functions serve gemini-ai --env-file .env
    ```

### Развертывание

Проект настроен для автоматического развертывания через GitHub Actions.
При пуше в ветку `main`:
1.  Применяются миграции базы данных.
2.  Разворачиваются Edge Functions.
3.  (Опционально) Происходит деплой в Railway.

Для ручного деплоя функций:
```bash
supabase functions deploy gemini-ai
```
