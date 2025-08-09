# Quick Supabase Setup Guide

Your Supabase project is configured! Here's how to get it running:

## Your Project Details
- **Project ID**: your-project-id
- **URL**: https://your-project.supabase.co
- **Anon Key**: configure via environment variables

Generate the runtime config files after setting your environment variables:

```bash
npm run build:config
```

This creates `js/supabase-config.js` and `js/public-config.js`.

## Step 1: Set Up Database Tables

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/your-project-id)
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of `setup-database.sql` into the editor
5. Click **Run** to create all tables, indexes, and security policies

## Step 2: Set Up Storage

1. Still in the SQL Editor, create a new query
2. Copy and paste the contents of `setup-storage.sql`
3. Click **Run** to create the storage bucket and policies

## Step 3: Test Your Setup

1. Open `test-supabase.html` in your browser
2. Click **Initialize Supabase** (your credentials are already filled in)
3. Test the features:
   - ✅ Database connection
   - ✅ User authentication (sign up with email/password)
   - ✅ File upload to storage
   - ✅ User profile creation

## Step 4: Optional - Set Up OAuth Providers

### For Google Login:
1. Go to **Authentication > Providers** in your Supabase dashboard
2. Enable **Google** provider
3. You'll need to create a Google OAuth app and add the credentials

### For GitHub Login:
1. Go to **Authentication > Providers** in your Supabase dashboard
2. Enable **GitHub** provider
3. You'll need to create a GitHub OAuth app and add the credentials

## What's Already Configured

✅ **Database Schema**: All 7 tables with proper relationships  
✅ **Security**: Row Level Security policies protect user data  
✅ **Performance**: Indexes on all frequently queried columns  
✅ **Storage**: File upload bucket with security policies  
✅ **Authentication**: Email/password ready, OAuth providers available  

## Next Steps

Once your database is set up and tested:

1. **Integrate into your tools**: Use the Supabase client in your existing tools
2. **Add Stripe**: Set up payment processing for premium plans
3. **Deploy Edge Functions**: For quota checking and webhooks

## Need Help?

- **Database issues**: Check the Table Editor in your dashboard
- **Authentication issues**: Check Authentication > Users
- **Storage issues**: Check Storage > user-files bucket
- **General issues**: Check the Logs section in your dashboard

Your Supabase project is ready to power your image converter app! 🚀