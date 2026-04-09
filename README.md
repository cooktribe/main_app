Making Cooktribe APK
Git init
npm i -g eas-cli
eas login
eas build:configure
eas secret:push --scope project --env-file .env
eas build -p android --profile productionApk
<img width="535" height="215" alt="image" src="https://github.com/user-attachments/assets/af23dcdd-efe9-4eeb-95ff-22970a6dcb5a" />
