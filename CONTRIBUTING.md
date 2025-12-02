# Contributing to Walt IPFS Drive

Thank you for your interest in contributing to Walt! We welcome contributions from the community.

## 🌟 Ways to Contribute

- **Bug Reports**: Found a bug? Open an issue with steps to reproduce
- **Feature Requests**: Have an idea? Share it in the issues
- **Code Contributions**: Submit pull requests for fixes or features
- **Documentation**: Improve guides, fix typos, add examples
- **Community**: Help others in discussions and issues

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Git
- Docker (for backend development)
- Firebase account (for authentication)

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/walt.git
   cd walt
   ```

2. **Install Dependencies**
   ```bash
   # Frontend
   npm install
   
   # Backend
   cd backend
   npm install
   ```

3. **Configure Environment**
   ```bash
   # Frontend
   cp .env.local.example .env.local
   # Edit .env.local with your Firebase config
   
   # Backend
   cd backend
   cp env.example .env
   # Edit .env with your settings
   ```

4. **Start IPFS Node**
   ```bash
   # See backend/README.md for IPFS setup
   docker-compose up -d
   ```

5. **Run Development Servers**
   ```bash
   # Frontend (in root directory)
   npm run dev
   
   # Backend (in backend directory)
   npm run dev
   ```

## 📝 Code Guidelines

### General Principles

- **Keep it simple**: Write clear, readable code
- **Test your changes**: Ensure existing features still work
- **Document**: Add comments for complex logic
- **Follow conventions**: Match the existing code style

### Frontend (Next.js/TypeScript)

- Use TypeScript for type safety
- Follow React best practices (hooks, functional components)
- Use CSS modules for styling
- Keep components small and focused
- Add JSDoc comments for complex functions

Example:
```typescript
/**
 * Upload a file to IPFS
 * @param file - The file to upload
 * @param options - Upload options
 * @returns Promise with CID and metadata
 */
export async function uploadFile(file: File, options?: UploadOptions) {
  // Implementation
}
```

### Backend (Node.js/Express)

- Use ES modules (`import`/`export`)
- Validate all inputs
- Handle errors gracefully
- Use prepared statements for database queries
- Add comments for complex logic
- Follow RESTful conventions

Example:
```javascript
// Validate input
if (!fileId || typeof fileId !== 'string') {
  return res.status(400).json({ error: 'Invalid file ID' });
}

// Use prepared statements
const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
```

### Commit Messages

Follow conventional commits:

```
feat: add file preview for images
fix: resolve upload timeout issue
docs: update self-hosting guide
style: format dashboard component
refactor: simplify billing calculation
test: add tests for file upload
chore: update dependencies
```

## 🔀 Pull Request Process

### Before Submitting

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Test your changes**
   ```bash
   npm run build
   npm run lint
   ```

3. **Update documentation** if needed

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

### Submitting PR

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open Pull Request** on GitHub

3. **Fill out the PR template**
   - Describe what changed
   - Link related issues
   - Add screenshots if UI changed
   - List any breaking changes

4. **Wait for review**
   - Address feedback promptly
   - Keep discussion respectful
   - Be patient with review process

### PR Review Criteria

✅ Code is clean and well-documented  
✅ No linting errors  
✅ Existing features still work  
✅ New features include basic documentation  
✅ Commit messages follow conventions  
✅ No sensitive data or credentials  

## 🐛 Bug Reports

When reporting bugs, include:

1. **Clear title**: "Upload fails for files > 100MB"
2. **Description**: What happened vs what you expected
3. **Steps to reproduce**:
   ```
   1. Go to dashboard
   2. Upload file larger than 100MB
   3. See error message
   ```
4. **Environment**:
   - OS: Windows 10
   - Browser: Chrome 120
   - Version: Latest
5. **Screenshots** if applicable
6. **Error messages** (console logs, stack traces)

## 💡 Feature Requests

When suggesting features:

1. **Clear title**: "Add bulk file download"
2. **Use case**: Explain why you need it
3. **Proposed solution**: How should it work?
4. **Alternatives**: Other ways to solve it?
5. **Mockups/examples**: Visual aids help!

## 📚 Documentation

Help improve our docs:

- Fix typos or unclear instructions
- Add missing setup steps
- Create tutorials or guides
- Translate to other languages
- Add code examples

## 🧪 Testing

We appreciate test coverage:

- Test new features
- Add edge case tests
- Test error handling
- Test with different browsers
- Test self-hosted setup

## 💬 Community

- **Be respectful**: Treat everyone with kindness
- **Be constructive**: Give helpful feedback
- **Be patient**: Maintainers are volunteers
- **Be collaborative**: Work together on solutions

## 🎯 Good First Issues

Look for issues labeled `good first issue` - these are great for new contributors!

## 📞 Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Open an Issue
- **Security issues**: See SECURITY.md
- **Quick questions**: Comment on related issues

## 🙏 Recognition

Contributors are recognized:
- Listed in release notes
- Mentioned in README.md
- Credited in commit history

Thank you for making Walt better! 🚀

