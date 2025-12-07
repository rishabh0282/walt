# GitHub Workflow Guide

This guide explains how to create issues and pull requests for the live GitHub repository.

## 📋 Prerequisites

1. **Fork the Repository** (if you don't have write access)
   - Go to: https://github.com/aayushman-singh/walt
   - Click "Fork" button
   - Clone your fork: `git clone https://github.com/YOUR_USERNAME/walt.git`

2. **Add Upstream Remote** (if forked)
   ```bash
   git remote add upstream https://github.com/aayushman-singh/walt.git
   ```

3. **Create Local Branch** (already done)
   ```bash
   git checkout -b local
   ```

## 🐛 Creating Issues

### Option 1: Using GitHub Web Interface

1. Go to: https://github.com/aayushman-singh/walt/issues
2. Click "New Issue"
3. Choose template:
   - **Bug Report** - For bugs and errors
   - **Feature Request** - For new features
4. Fill out the template
5. Click "Submit new issue"

### Option 2: Using GitHub CLI

```bash
# Install GitHub CLI if not installed
# Windows: winget install GitHub.cli
# Mac: brew install gh
# Linux: See https://cli.github.com/

# Authenticate
gh auth login

# Create bug report
gh issue create --title "[BUG] Description" --body-file .github/ISSUE_TEMPLATE/bug_report.md

# Create feature request
gh issue create --title "[FEATURE] Description" --body-file .github/ISSUE_TEMPLATE/feature_request.md
```

### Issue Labels

Common labels to use:
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `local-setup` - Related to local development setup

## 🔀 Creating Pull Requests

### Step 1: Push Your Local Branch

```bash
# Make sure you're on the local branch
git checkout local

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Working local development setup with bug fixes

- Fix folder creation sync with backend database
- Fix SQL parameter mismatch in /api/ipfs/list
- Fix FOREIGN KEY constraint errors
- Fix modal state closure issues
- Fix IPFS gateway CORS issues
- Add input validation and sanitization
- Add temp file cleanup
- Improve error handling and messages
- Add GitHub issue/PR templates"

# Push to your fork (or origin if you have write access)
git push origin local
```

### Step 2: Create Pull Request

#### Option A: Using GitHub Web Interface

1. Go to: https://github.com/aayushman-singh/walt
2. You should see a banner: "local had recent pushes" with "Compare & pull request" button
3. Click "Compare & pull request"
4. Fill out the PR template
5. Add reviewers (if applicable)
6. Click "Create pull request"

#### Option B: Using GitHub CLI

```bash
# Create PR from command line
gh pr create --title "feat: Working local development setup with bug fixes" \
  --body-file .github/pull_request_template.md \
  --base main \
  --head local
```

### PR Best Practices

1. **Clear Title**: Start with type (`feat:`, `fix:`, `docs:`, etc.)
2. **Descriptive Body**: Use the PR template, explain what and why
3. **Link Issues**: Reference related issues with `Closes #123` or `Fixes #123`
4. **Screenshots**: Add screenshots for UI changes
5. **Testing**: Describe how you tested the changes
6. **Small PRs**: Keep PRs focused and small when possible

## 📝 Issue & PR Templates

Templates are located in:
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`

These will automatically populate when creating issues/PRs on GitHub.

## 🔄 Syncing with Upstream

If the main repository gets updates:

```bash
# Fetch upstream changes
git fetch upstream

# Merge into your local branch (if needed)
git checkout local
git merge upstream/main

# Or rebase (cleaner history)
git rebase upstream/main
```

## 🏷️ Branch Naming Conventions

- `local` - Local development setup (this branch)
- `main` - Production-ready code
- `develop` - Development branch (if exists)
- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/documentation-update` - Documentation

## ✅ Checklist Before Creating PR

- [ ] Code follows project style guidelines
- [ ] All tests pass (if applicable)
- [ ] No linter errors
- [ ] Documentation updated (if needed)
- [ ] Commit messages are clear
- [ ] PR description is complete
- [ ] Related issues linked
- [ ] Screenshots added (for UI changes)

## 🎯 Example Workflow

```bash
# 1. Create and switch to feature branch
git checkout -b local

# 2. Make changes and commit
git add .
git commit -m "fix: Description of fix"

# 3. Push to your fork
git push origin local

# 4. Create PR via GitHub web or CLI
gh pr create --title "fix: Description" --body "Details..."

# 5. Wait for review and address feedback
# 6. Once approved, maintainer will merge
```

## 📚 Additional Resources

- [GitHub Issues Guide](https://guides.github.com/features/issues/)
- [GitHub Pull Requests Guide](https://docs.github.com/en/pull-requests)
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format

## 🆘 Need Help?

- Check existing issues: https://github.com/aayushman-singh/walt/issues
- Ask in discussions: https://github.com/aayushman-singh/walt/discussions
- Read CONTRIBUTING.md for more details

