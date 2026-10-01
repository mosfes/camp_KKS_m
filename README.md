# Next.js & HeroUI Template

## Progressive Web App and student bus push notifications

The application includes a web app manifest, install icons, a service worker,
and persistent Web Push subscriptions for student bus reminders. When a teacher
sends a board or alight reminder, subscribed student devices receive a system
notification even when the application is not currently open. The existing
in-app popup remains the fallback while the application is open.

Generate one VAPID key pair and keep it stable across deployments:

```bash
npm run web-push:keys
```

Configure the generated values in every production environment:

```env
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=your_public_key
WEB_PUSH_VAPID_PRIVATE_KEY=your_private_key
WEB_PUSH_VAPID_SUBJECT=https://your-production-domain.example
```

Apply the database migration before deploying the application:

```bash
npm run db:migrate:deploy
npm run build
```

Production Web Push requires HTTPS. On iPhone and iPad, iOS 16.4 or newer is
required and the user must first add KKS Camp to the Home Screen, open it from
the installed icon, and enable notifications from the bell menu. Never commit
the private VAPID key to source control.

## Camp reminder emails with Resend

The production app sends two transactional reminders. Seven days before a
camp, eligible students who have not joined yet receive an invitation. Three
days before the camp, confirmed students and camp staff receive a preparation
reminder. The job reads the existing Prisma roster, so multiple camps starting
on the same date are handled together and a recipient can receive a separate
message for each camp.

Create a Resend API key and verify the sender domain before enabling the Cron
job. The two responsive Thai email templates are rendered by the application,
so no hosted template IDs are required.

Set these production environment variables:

```env
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=camp@your-domain.example
RESEND_FROM_NAME=KKS Camp
RESEND_DAILY_SEND_LIMIT=90
CAMP_APP_URL=https://your-production-domain.example
CRON_SECRET=your_random_vercel_cron_secret
```

Resend Free allows 100 sends per day; the default `RESEND_DAILY_SEND_LIMIT=90`
leaves room for other transactional messages in the same account. If a day has
more recipients than the limit, the durable queue continues on the next Cron
run. The limit is stored by Bangkok calendar date in the database, so repeated
or manually triggered runs cannot each consume another 90 messages. A
short-lived database lock also prevents overlapping Cron executions.

The daily job reconciles every camp starting within the next seven days, rather
than relying on one exact run. This means a missed Cron invocation is caught up:
unenrolled students receive the join reminder while the camp is D-7 through
D-1, and enrolled students plus camp staff receive the starting reminder while
the camp is D-3 through D-1. Queue uniqueness prevents the same reminder from
being sent twice, including when multiple camps start on the same day.

Definite Resend rejections are retried up to three times. A network timeout or
other result where Resend may already have accepted the batch is stored as
`UNKNOWN` and is deliberately not retried automatically; inspect those rows in
`camp_email_reminder` before deciding whether to resend. Rows that reach the
retry ceiling are stored as `EXHAUSTED`. Pending recipient names and email
addresses are refreshed from the current roster before sending.

Deploy the Prisma migration before the application deployment:

```bash
npm run db:migrate:deploy
npm run test:camp-reminders
npm run build
```

Vercel invokes `/api/cron/camp-reminders` once per day at 07:10 UTC (14:10 in
Thailand). The endpoint requires the `CRON_SECRET` bearer token and is not
intended to be called from the browser.

## Camp location tracking

The camp tracking screen uses Google Maps JavaScript API, Places API (New),
Routes API, and Geocoding API for destination lookup, map display, the student's
route to the camp destination, and the student's current Thai administrative
area. Create a browser API key restricted to the application's HTTPS domains and
enable all four APIs:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_key
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id
```

Apply Prisma migrations before starting the updated application. Browser GPS
requires HTTPS in production (localhost is allowed during development).
Teachers can search or click the Google Map to pin a destination and choose a
5- or 10-minute update interval. Each registered student publishes only their
own location while the camp page is open. Teachers can see all registered
students, while a parent can see only the student linked to their account.

The student route uses the Routes Essentials tier without live traffic. It is
calculated only when the student opens the map, cached in the browser for 15
minutes, reused while the student remains within 500 metres of the cached
origin, and manually refreshable with a one-minute cooldown. If Routes API is
unavailable, the UI falls back to a straight line and an approximate distance.
The reverse-geocoded subdistrict, district, and province are stored in the same
cache and requested only after the student opens the map, so page visits and GPS
polling do not generate additional Geocoding requests.

### Direct Cloudinary image uploads

Student profile images, mission photos, and certificate templates upload
directly from the browser to Cloudinary. Configure one signed upload preset in
Cloudinary and set its server-side file limit before deploying:

```env
CLOUDINARY_UPLOAD_PRESET=your_shared_preset
```

Set `max_file_size` to 20 MB on the shared preset. Mission uploads verify
Cloudinary's signed upload response without using Admin API quota; profile
images and certificate templates still apply their stricter 5 MB commit limits.
The old
`/api/student/profile/upload-image` route no longer accepts file bytes through
Vercel.

Production schema changes are deployed separately from the Next.js build:

```bash
npm run db:migrate:deploy
npm run build
```

The build no longer runs `prisma db push --accept-data-loss`.

To prevent unexpected charges, set billing alerts for the project and a daily
quota for Routes: Compute Routes Essentials. A daily Routes quota around 300
requests keeps a 31-day month below 10,000 requests. Dynamic Maps usage is
reduced by loading the map only after the student presses the display button.

This is a template for creating applications using Next.js 14 (app directory) and HeroUI (v2).

[Try it on CodeSandbox](https://githubbox.com/heroui-inc/heroui/next-app-template)

## Technologies Used

- [Next.js 14](https://nextjs.org/docs/getting-started)
- [HeroUI v2](https://heroui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind Variants](https://tailwind-variants.org)
- [TypeScript](https://www.typescriptlang.org/)
- [Framer Motion](https://www.framer.com/motion/)
- [next-themes](https://github.com/pacocoursey/next-themes)

## How to Use

### Use the template with create-next-app

To create a new project based on this template using `create-next-app`, run the following command:

```bash
npx create-next-app -e https://github.com/heroui-inc/next-app-template
```

### Install dependencies

You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm`:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Setup pnpm (optional)

If you are using `pnpm`, you need to add the following code to your `.npmrc` file:

```bash
public-hoist-pattern[]=*@heroui/*
```

After modifying the `.npmrc` file, you need to run `pnpm install` again to ensure that the dependencies are installed correctly.

## License

Licensed under the [MIT license](https://github.com/heroui-inc/next-app-template/blob/main/LICENSE).
