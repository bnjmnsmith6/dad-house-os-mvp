# Publish (blocked pending PAT scopes)

Current `gh` fine-grained PAT can **read** repos but cannot:
- `createRepository` (403)
- `git push` / Contents write (403)

## Fix (Ben)

1. Create public repo `bnjmnsmith6/dad-house-os-mvp` on github.com (or expand PAT: Account → Create repositories + Contents R/W on that repo).
2. From this folder:

```bash
cd /workspace/dad-house-os/mvp-ship
git remote add origin https://github.com/bnjmnsmith6/dad-house-os-mvp.git 2>/dev/null || git remote set-url origin https://github.com/bnjmnsmith6/dad-house-os-mvp.git
gh auth setup-git
git push -u origin main
gh api -X POST repos/bnjmnsmith6/dad-house-os-mvp/pages -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/'
```

Expected URL: https://bnjmnsmith6.github.io/dad-house-os-mvp/
