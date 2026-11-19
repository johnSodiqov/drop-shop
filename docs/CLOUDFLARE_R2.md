# Cloudflare R2 для DropStore

## Переменные Backend

Добавьте следующие переменные в `.env` или Railway:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=dropstore-public
R2_ENDPOINT=
R2_PUBLIC_URL=
```

Секретные значения никогда не должны начинаться с `VITE_` и не передаются во Frontend.

## Создание R2

1. В Cloudflare откройте `R2 Object Storage`.
2. Создайте bucket с именем `dropstore-public`.
3. Откройте `Manage R2 API tokens`.
4. Создайте API Token с правом Object Read & Write только для этого bucket.
5. Скопируйте Account ID, Access Key ID и Secret Access Key.
6. Получите endpoint вида `https://ACCOUNT_ID.r2.cloudflarestorage.com`.

## Публичный домен

Для домена `images.dropstore.uz`:

1. В настройках bucket выберите `Settings -> Public Development URL` либо Custom Domains.
2. Подключите свой домен `images.dropstore.uz`.
3. В DNS Cloudflare создайте запись/привязку домена, предложенную Cloudflare.
4. Укажите в `R2_PUBLIC_URL=https://images.dropstore.uz`.
5. Проверьте публичный URL после загрузки.

## Railway

В Railway откройте сервис Backend и добавьте переменные из секции выше.

- `R2_BUCKET_NAME=dropstore-public`
- `R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `R2_PUBLIC_URL=https://images.dropstore.uz`

Затем выполните Deploy/Redeploy Backend.

## Проверка API

Загрузка с JWT администратора:

```bash
curl -X POST "https://<BACKEND_HOST>/api/v1/storage/upload?directory=products" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "file=@image.jpg"
```

Массовая загрузка:

```bash
curl -X POST "https://<BACKEND_HOST>/api/v1/storage/upload/multiple?directory=products" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "files=@image1.jpg" \
  -F "files=@image2.webp"
```

Удаление:

```bash
curl -X DELETE "https://<BACKEND_HOST>/api/v1/storage/products/<UUID>.jpg" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Список объектов доступен только администраторам:

```bash
curl "https://<BACKEND_HOST>/api/v1/storage/list?directory=products&limit=50" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## Ограничения

- Разрешены JPEG, PNG и WEBP.
- Максимальный размер одного файла: 10 МБ.
- Изображения масштабируются до 2400 px с сохранением пропорций.
- Ключи создаются как `products|categories|banners|brands/<UUID>.<ext>`.
- Пользовательские имена файлов не используются в Object Key.
