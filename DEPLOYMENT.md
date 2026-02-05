# Deployment Guide - Render

## Prerequisites
1. Push your code to GitHub (create a repository if you haven't)
2. Create a MongoDB Atlas account (free tier)
3. Create a Render account at https://render.com

## Step 1: Set up MongoDB Atlas (Free)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create a free cluster
3. Under Security → Database Access, create a database user with password
4. Under Security → Network Access, add `0.0.0.0/0` (allow from anywhere)
5. Click "Connect" → "Connect your application"
6. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
7. Replace `<password>` with your actual password

## Step 2: Deploy on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository with your backend code
5. Configure the service:
   - **Name**: medi-backend (or any name you prefer)
   - **Region**: Oregon (or closest to you)
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

6. **Environment Variables** - Add these in the Render dashboard:
   ```
   MONGO_URL=mongodb+srv://your-connection-string-from-atlas
   DB_NAME=medi_production
   EMERGENT_LLM_KEY=your-llm-api-key
   ```

7. Click "Create Web Service"

## Step 3: Wait for Deployment

- Render will automatically build and deploy your app
- First deployment takes 5-10 minutes
- You'll get a URL like: `https://medi-backend.onrender.com`

## Step 4: Test Your Backend

Once deployed, test the API:
```bash
curl https://your-app-name.onrender.com/
```

## Step 5: Update Frontend

Update your frontend's environment variables to use the new backend URL:
```
EXPO_PUBLIC_BACKEND_URL=https://your-app-name.onrender.com
```

## Important Notes

- **Free tier sleeps after 15 minutes of inactivity** - First request after sleep takes 30-60 seconds
- Auto-deploys on every Git push to main branch
- View logs in Render dashboard
- Free tier includes 750 hours/month

## Troubleshooting

If deployment fails, check:
1. Render logs for error messages
2. All environment variables are set correctly
3. MongoDB Atlas network access allows all IPs
4. requirements.txt includes all dependencies

## Alternative: Using render.yaml (Automated)

I've created a `render.yaml` file in your backend folder. To use it:

1. Push code to GitHub including the `render.yaml` file
2. In Render dashboard: New + → Blueprint
3. Connect your repository
4. Render will auto-configure from the YAML file
5. Just add environment variables in the dashboard

This automatically sets up the service with correct configuration.
