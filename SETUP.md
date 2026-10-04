# Firebase setup

1. console.firebase.google.com > Add project
2. Project settings > Your apps > Web (</>) > register app > copy the Firebase web config values into `.env.local` using the `VITE_FIREBASE_*` names in `.env.example`
3. Build > Authentication > Get started > enable Email/Password and Google
4. Authentication > Settings > Authorized domains > make sure `localhost` (and your deployed domain) is listed
5. Build > Firestore Database > Create database > production mode > pick a region
6. Firestore > Rules > paste `firestore.rules` > Publish (or `firebase deploy --only firestore`)
7. `npm install` then `npm run dev`
8. Register your account in the app
9. Firestore > `users` > your uid document > change `role` from `participant` to `admin`
10. Reload the app. Stocks, news and `simulation/config` are seeded automatically on first load

For Vercel, add every `VITE_FIREBASE_*` variable from `.env.example` in Project Settings > Environment Variables for Production and Preview. The Yahoo Finance API routes are exposed through `api/index.ts`; deploy with the included `vercel.json`.

Collections (created automatically): users, stocks, price_history, holdings, transactions, news, simulation
