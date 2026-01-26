# העברת האתר ל-Vercel

## למה Vercel?

Vercel תומך ב-serverless functions, מה שאומר שה-OG meta tags יעבדו נכון עם crawlers של Facebook/WhatsApp.

## איך להעביר:

### 1. היכנס ל-Vercel
- לך ל-[vercel.com](https://vercel.com)
- התחבר עם GitHub

### 2. Import Project
- לחץ על "Add New..." → "Project"
- בחר את ה-repository `whatsapp-lottery`
- Vercel יזהה אוטומטית את `vercel.json`

### 3. Deploy
- לחץ על "Deploy"
- Vercel יעשה deploy אוטומטי

### 4. ה-URL החדש
- אחרי ה-deploy, תקבל URL כמו: `whatsapp-lottery.vercel.app`
- אפשר גם להוסיף domain מותאם אישית

## מה קורה אחרי ההעברה:

✅ ה-OG meta tags יעבדו נכון  
✅ התמונות יופיעו ב-Facebook/WhatsApp preview  
✅ הכל יעבוד כמו שצריך  

## הערות:

- הקוד כבר מוכן ל-Vercel (יש `api/og.js` ו-`vercel.json`)
- ה-URLs יעבדו גם ב-Vercel (הקוד משתמש ב-`window.location.origin`)
- אפשר להמשיך להשתמש ב-`?c=...` format או לעבור ל-`/l/...` format
