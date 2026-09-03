# STELLARCAST Static Export Configuration

## GitHub Pages Deployment

This project is configured to deploy automatically to GitHub Pages as a static site.

### How It Works

1. **Static Export**: Next.js builds a static site (`output: 'export'`)
2. **Base Path**: Automatically configured for `/<repo-name>/` paths
3. **GitHub Actions**: Builds and deploys on every push to `main`
4. **Pages Hosting**: Served from `https://<user>.github.io/<repo-name>/`

### Configuration Files

- `next.config.ts`: Static export + basePath configuration
- `.github/workflows/deploy.yml`: Automated build and deployment
- `package.json`: Build scripts for static generation

### Local Testing

```bash
# Build static site
npm run build

# Output is in ./out/
# Serve locally:
npx serve out
```

### Deployment URL

After GitHub Actions completes, site is available at:
```
https://cellact-nl.github.io/tmp-af48bfe1e0cdf6d9/
```

### Static Hosting Trade-offs

**✅ Benefits:**
- Free hosting via GitHub Pages
- Automatic CI/CD with GitHub Actions
- Fast global CDN delivery
- No server costs

**⚠️ Limitations:**
- No server-side rendering (SSR)
- No API routes
- No real-time blockchain sync
- Demo mode only (mock adapters)

**Perfect for:**
- Hackathon demos
- Privacy architecture showcase
- Client-side crypto demonstrations
- Static prototypes

For production with live blockchain integration, deploy to server platform (Vercel, AWS, etc).
