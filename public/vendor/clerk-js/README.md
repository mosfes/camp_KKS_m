# ClerkJS browser bundle

These files are the browser build of `@clerk/clerk-js` version `5.128.0` (MIT license). The app serves them from its own origin through `clerkJSUrl` in `components/ConfiguredClerkProvider.tsx`.

Source: `https://registry.npmjs.org/@clerk/clerk-js/-/clerk-js-5.128.0.tgz`. Only `dist/*clerk.browser*` files are included. The SHA-256 of `clerk.browser.js` is `7cecff29777ab892328d6df7c563808129972d439b5729c5843603500fa78879`, matching the same version served by the Clerk frontend API when vendored.

When updating `@clerk/nextjs`, check its compatible ClerkJS major version, replace this complete browser file set from a pinned npm release, update the version and hash here, and test the sign-in and Google OAuth flows.
