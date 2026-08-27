You are the lead senior full-stack engineer responsible for building the complete Photopol AI image SaaS MVP from start to production deployment.

DO NOT create a mockup, prototype-only UI, fake API responses, fake AI results, or placeholder functionality.

Build a REAL, working, production-ready MVP.

The product is called:

PHOTOPOL

Brand positioning:

"Create. Edit. Enhance. Resize. Export."

"One AI Workspace for Every Image."

Use the provided Photopol design/reference image in the workspace as the primary visual reference. Reproduce its overall visual language: premium dark SaaS aesthetic, black/dark backgrounds, white typography, subtle purple/violet accents, elegant spacing, rounded cards, subtle borders, modern typography, minimal UI and polished responsive layouts.

Do not copy another company's code or branding.

==================================================

1. PRODUCT GOAL
   ==================================================

Photopol will eventually be an all-in-one AI image workspace.

Long-term workflow:

Upload / Generate
→ Edit
→ Enhance
→ Resize
→ Export

Future functionality will include:

* AI image generation
* AI image editing
* Background removal
* Background replacement
* Object removal
* Image enhancement
* AI upscaling
* Resize/crop
* Social media sizes
* Multiple export formats
* Product image workflows
* Batch processing
* Multiple AI providers

PHASE 1 must focus on a fully working core MVP.

==================================================
2. PHASE 1 ACCEPTANCE CRITERIA
==============================

The following must be fully functional, not demo screens:

USER SYSTEM

* Registration
* Login
* Logout
* Secure authentication
* Protected routes
* User roles

DASHBOARD

* User dashboard
* Real database statistics
* Credit balance
* Images processed
* Recent projects
* Recent image history
* Quick actions

IMAGE WORKFLOW

* Image upload
* Real AI background removal
* Before/after preview
* Resize
* Crop
* Aspect ratio selection
* High-quality download
* Image/project history

CREDITS

* Credit balance
* Credit transactions
* Credits deducted for successful AI operations
* Failed AI operations do NOT permanently consume credits
* Protection against duplicate deductions

ADMIN

* Basic admin dashboard
* User list
* User usage
* Project/image history
* Processing jobs
* Credit management
* Basic statistics

INFRASTRUCTURE

* PostgreSQL
* Persistent database
* Persistent image storage
* Backend API
* Secure API key handling
* Production configuration
* Docker support
* Deployment documentation

DEPLOYMENT

* Production website
* Connected to photopol.us
* Working frontend
* Working backend
* Working database
* Working AI processing
* Working uploads/downloads

DELIVERABLES

* Complete source code
* GitHub repository
* Database migrations/schema
* Environment variable documentation
* Deployment documentation
* README
* No intentionally hidden source code
* No fake integrations

==================================================
3. TECHNOLOGY STACK
===================

Use:

FRONTEND:

* Next.js
* TypeScript
* React
* Tailwind CSS
* Modern reusable component architecture

BACKEND:

* Python
* FastAPI
* Pydantic
* SQLAlchemy

DATABASE:

* PostgreSQL

CACHE/JOBS:

* Redis-ready architecture
* Background processing architecture
* Keep implementation simple enough for Phase 1 but extensible

STORAGE:

* S3-compatible object storage

AI:

* Replicate API
* Recraft Remove Background initially

PAYMENTS:

* Stripe foundation
* Test mode for Phase 1

DEPLOYMENT:

* Docker
* Docker Compose for local development
* Production-ready configuration

==================================================
4. PROJECT STRUCTURE
====================

Create a clean monorepo:

/frontend
/backend
/infrastructure
/docs

Use clear separation of responsibilities.

Do not put business logic directly into React components.

Do not put AI provider logic directly into route handlers.

Do not duplicate database logic.

Create reusable services and repositories where appropriate.

==================================================
5. AI PROVIDER ARCHITECTURE
===========================

IMPORTANT:

Do NOT tightly couple Photopol to Replicate.

Use an abstraction.

Architecture:

Frontend
→ FastAPI API
→ AI Service
→ Provider Interface
→ Replicate Provider
→ Recraft Background Removal

Create interfaces/classes that allow future providers.

Example conceptual architecture:

AIService
BackgroundRemovalProvider
ReplicateBackgroundRemovalProvider

Future providers should be able to implement the same interface.

The application must be prepared for future:

* OpenAI image generation/editing
* Gemini image functionality
* FLUX
* Replicate models
* Self-hosted models
* Other specialized image APIs

Do not rebuild the core application when adding another provider.

==================================================
6. REPLICATE BACKGROUND REMOVAL
===============================

Implement REAL Replicate API integration.

Use Recraft Remove Background as the initial provider.

The Replicate API key must ONLY exist on the backend.

NEVER expose it in:

* React
* Next.js client components
* browser JavaScript
* HTML
* API responses
* public environment variables

Use server-side environment variables.

Implement:

POST /api/projects/{project_id}/background-removal

Workflow:

1. Authenticate user.
2. Verify project ownership.
3. Verify image ownership.
4. Verify sufficient credits.
5. Create processing job.
6. Mark job PROCESSING.
7. Send image to Replicate.
8. Wait/poll for completion as appropriate.
9. Retrieve result.
10. Store processed image.
11. Create image version.
12. Deduct credits only after successful completion.
13. Create credit transaction.
14. Mark job COMPLETED.
15. Return result.

On failure:

* Mark job FAILED.
* Do not permanently consume credits.
* Store useful error information.
* Return safe user-facing error.
* Do not expose provider secrets.

Prevent duplicate processing/double charging.

Make the AI operation configurable.

Do not hardcode the credit cost throughout the application.

==================================================
7. IMAGE UPLOAD
===============

Support:

* JPG
* JPEG
* PNG
* WEBP

Implement:

* File type validation
* MIME validation
* File size limit
* Filename sanitization
* Server-side validation
* Secure storage
* Unique storage paths

Never trust client-provided filenames.

Each image must belong to:

User
→ Project
→ Image

Users must NEVER be able to access another user's images/projects by changing IDs.

Implement authorization checks server-side.

==================================================
8. DATABASE
===========

Create PostgreSQL models/tables for at least:

User
Project
Image
ImageVersion
ProcessingJob
CreditTransaction

Include role support:

USER
ADMIN

Recommended fields should include:

created_at
updated_at

Use database migrations.

Do not manually create production tables without migrations.

Create indexes where useful.

Use foreign keys and appropriate constraints.

Prevent orphaned data where appropriate.

==================================================
9. AUTHENTICATION
=================

Implement:

* Registration
* Login
* Logout
* Password hashing
* JWT authentication
* Protected API endpoints
* Protected frontend routes
* Role authorization

Never store plaintext passwords.

Never return password hashes.

Implement proper validation.

Handle:

* Invalid credentials
* Duplicate email
* Expired token
* Unauthorized request
* Forbidden admin request

Create:

/login
/register
/dashboard

Unauthenticated users attempting to access protected pages should be redirected to login.

==================================================
10. DASHBOARD
=============

Create a polished Photopol dashboard matching the provided visual direction.

Sidebar:

Photopol
Dashboard
My Projects
AI Tools
Credits
Billing
Settings
Admin Panel (admins only)
Logout

Main dashboard:

"Welcome back, {name}!"

Cards:

* Credits Balance
* Images Processed
* Storage Used
* Account information

Recent Projects.

Quick Actions:

* Remove Background
* Resize Image
* Crop Image

All statistics must come from the real database.

DO NOT use fake numbers.

DO NOT hardcode statistics.

==================================================
11. PROJECT SYSTEM
==================

Users can create projects.

Each project can contain images and image versions.

Project page should show:

* Original image
* Processed image
* Processing status
* Operation history
* Created date
* Download options

Preserve the original image.

Do not overwrite originals.

Every processing operation should create an appropriate version/history record.

==================================================
12. AI EDITOR UI
================

Create a polished image workspace.

Layout:

Left:
Tool controls.

Center:
Image preview.

Right:
History/settings where appropriate.

For Phase 1, provide:

* Remove Background
* Crop
* Resize
* Aspect Ratio

Show:

Before
After

Provide a comparison slider if practical.

Processing state:

"AI is processing your image..."

Show useful progress/loading UI.

Show errors clearly.

Do not block the entire application unnecessarily.

==================================================
13. RESIZE AND CROP
===================

Implement REAL processing.

Presets:

1:1
4:5
16:9
9:16

Allow:

* Custom width
* Custom height
* Crop
* Resize

Process images server-side.

Preserve image quality.

Create new image versions.

Do not overwrite original.

Protect against absurd dimensions that could consume excessive server resources.

==================================================
14. DOWNLOAD
============

Allow users to download processed images.

Support at least:

PNG
JPG/WEBP where technically appropriate.

For background-removed images, preserve transparency using PNG.

Provide high-quality output.

Ensure downloaded file actually exists and is valid.

==================================================
15. IMAGE HISTORY
=================

Create:

/projects

and project detail pages.

Show:

* Thumbnail
* Original
* Processed version
* Operation
* Date
* Status
* Download

Use real database records.

Add empty states when there are no projects.

==================================================
16. CREDIT SYSTEM
=================

Implement a real credit system.

Create CreditTransaction.

Track:

* User
* Amount
* Type
* Operation
* Job/reference ID
* Timestamp

Example:

Background removal = configurable number of credits.

Rules:

1. Check balance before operation.
2. Prevent concurrent duplicate deductions.
3. Deduct only after successful processing.
4. Failed operations do not permanently consume credits.
5. Record every transaction.

Dashboard displays real balance.

Create:

/credits

with transaction history.

==================================================
17. ADMIN DASHBOARD
===================

Create:

/admin

Only ADMIN users can access it.

Admin dashboard should show:

* Total users
* Images processed
* Processing jobs
* Failed jobs
* Credit usage
* Recent users

User table:

* Name
* Email
* Role
* Credits
* Created date
* Status

Admin can:

* View users
* View projects
* View processing jobs
* Adjust credits

All authorization must happen server-side.

Do NOT simply hide admin links from normal users.

==================================================
18. STRIPE
==========

Implement the foundation for Stripe.

Phase 1:

* Stripe SDK
* Environment variables
* Test mode
* Product/price configuration
* Checkout session endpoint
* Webhook endpoint
* Webhook signature verification
* Payment event persistence

Keep production billing simple.

Architecture must later support:

* Credit packs
* Monthly subscriptions
* Annual subscriptions
* Billing portal
* Upgrades
* Downgrades

Stripe secret key must never be exposed to the frontend.

==================================================
19. LANDING PAGE
================

Build the Photopol landing page based on the supplied design.

Hero:

"Create. Edit. Enhance. Resize. Export."

"One AI Workspace for Every Image."

Supporting copy:

"Stop jumping between AI tools. Photopol brings your entire image workflow into one place — from creation and editing to enhancement, resizing, and export."

Primary CTA:

"Try Photopol Free"

Secondary:

"See How It Works"

Hero visual should demonstrate:

Original image
→ AI processing
→ Result

Include:

* Tool navigation
* Product explanation
* Tool grid
* Five-step workflow
* Target audience
* CTA
* Footer

Tool cards:

AI Image Generation
AI Image Editing
Background Removal
Background Replacement
Object Removal
Image Enhancement
AI Upscaling
Resize & Crop
Social Media Sizes

Phase 1 tools should be available.

Future tools can show:

COMING SOON

Do not create fake functionality behind unavailable tools.

==================================================
20. LANDING PAGE COPY
=====================

Section:

"Stop Using 10 Different Tools for One Image."

Supporting idea:

One image should not require moving between multiple AI tools.

Use:

"Upload once. Do everything in one workspace."

Explain:

Generate, edit, remove backgrounds, enhance, resize and export without moving the image between different platforms.

Workflow:

"Five steps. One workspace."

01 Upload or Generate
02 Edit
03 Enhance
04 Resize
05 Export

Target audiences:

E-commerce Product Images
Social Media Content
Marketing Campaigns
Creator Content
Professional Photography
Personal Projects

Final CTA:

"Be First to Try Photopol"

Make CTA connect to the actual registration flow.

==================================================
21. SEO
=======

Implement:

* Page titles
* Meta descriptions
* OpenGraph
* Canonical URLs
* Sitemap
* Robots.txt
* Semantic HTML
* Proper H1/H2 hierarchy
* Image alt attributes
* Fast-loading pages

Create initial SEO pages:

/ai-background-remover
/background-remover
/image-resizer

These must be useful pages, not spam.

Connect tool pages to the actual application.

Future pages should be easy to add:

/ai-image-generator
/object-remover
/ai-upscaler
/image-enhancer
/background-replacer

Avoid keyword stuffing.

==================================================
22. TRAFFIC AND MONETIZATION FOUNDATION
=======================================

Photopol is intended to generate revenue from traffic.

Build the architecture around:

SEO traffic
→ Free tool
→ Registration
→ Free credits
→ AI usage
→ Paid credits/subscription

Prepare the UI for:

* Free plan
* Credit packages
* Subscription plans
* Upgrade CTA
* Usage limits

Do not build an overly complicated billing system in Phase 1.

Prepare the architecture for Google Analytics/Search Console integration.

Do not place excessive ads in the core editor.

User experience and conversion should remain the priority.

==================================================
23. RESPONSIVE DESIGN
=====================

Everything must work on:

Desktop
Tablet
Mobile

Test:

375px
390px
768px
1024px
1440px+

Mobile dashboard should use a mobile navigation pattern.

Image editor should remain usable on mobile.

Do not simply shrink desktop UI.

==================================================
24. SECURITY
============

Implement proper security.

Requirements:

* Environment variables
* No secrets in frontend
* No secrets in Git
* Secure password hashing
* JWT validation
* Authorization checks
* Project ownership checks
* Admin authorization
* Upload validation
* File size limits
* MIME validation
* Rate limiting around AI endpoints
* CORS configuration
* Secure headers where appropriate
* SQL injection protection through ORM/parameterized queries
* Safe error responses
* No sensitive provider errors returned to users

Search repository for accidentally committed secrets.

Create .env.example.

Never commit .env.

==================================================
25. ERROR HANDLING
==================

Implement consistent API error responses.

Handle:

* Invalid upload
* Invalid image
* AI provider failure
* Timeout
* Storage failure
* Database failure
* Insufficient credits
* Unauthorized access
* Rate limit
* Stripe webhook failure

Frontend should show human-readable messages.

Backend logs should contain useful diagnostic information without exposing secrets.

==================================================
26. DOCUMENTATION
=================

Create:

README.md

docs/ARCHITECTURE.md
docs/DEPLOYMENT.md
docs/AI_PROVIDER.md
docs/STRIPE.md

Document:

* Requirements
* Local development
* Environment variables
* Database setup
* Migrations
* Storage
* Replicate setup
* Stripe setup
* Production deployment
* Admin creation
* Troubleshooting

==================================================
27. DOCKER
==========

Create Docker configuration for:

Frontend
Backend
PostgreSQL
Redis

Create docker-compose for local development.

Ensure services communicate correctly.

Do not hardcode credentials.

==================================================
28. DOMAIN
==========

Production domain:

https://photopol.us

Prepare configuration for:

photopol.us

and:

[www.photopol.us](http://www.photopol.us)

Redirect www appropriately.

HTTPS must be supported.

Do not claim DNS is configured unless access is actually available.

Provide exact DNS/deployment instructions if credentials are unavailable.

==================================================
29. GITHUB
==========

Prepare repository for GitHub.

Create:

.gitignore

.env.example

README.md

Proper commit-friendly structure.

Do not commit:

.env
API keys
Passwords
Tokens
Private credentials
Uploaded images
Database dumps

==================================================
30. TESTING
===========

Implement appropriate tests for important backend functionality.

At minimum test:

* Registration
* Login
* Authentication
* Authorization
* Project ownership
* Credit deduction
* Failed AI operation credit handling
* Admin authorization
* Upload validation

Test critical frontend flows where practical.

==================================================
31. DEVELOPMENT PROCESS
=======================

IMPORTANT:

Do NOT attempt to generate the entire project blindly in one pass.

Work systematically.

First inspect the existing repository.

If files already exist, preserve useful existing work.

Then:

1. Create architecture.
2. Create project structure.
3. Install dependencies.
4. Configure environment.
5. Create database models/migrations.
6. Build backend.
7. Build authentication.
8. Build frontend.
9. Build dashboard.
10. Build upload/storage.
11. Build real AI workflow.
12. Build resize/crop.
13. Build history.
14. Build credits.
15. Build admin.
16. Build Stripe foundation.
17. Build landing page.
18. Build SEO.
19. Build Docker/deployment.
20. Run tests.
21. Perform security audit.
22. Perform production build.
23. Fix all errors.
24. Verify acceptance criteria.

After every major stage:

* Run the application.
* Run tests.
* Check TypeScript.
* Check Python.
* Check database migrations.
* Fix errors before continuing.

Do not leave known build errors.

Do not replace real functionality with placeholders to make tests pass.

==================================================
32. FINAL QA
============

Before declaring completion, inspect the entire repository.

Search for:

TODO
FIXME
MOCK
FAKE
PLACEHOLDER
HARDCODED
console.log
test-secret
password
api_key

Review all occurrences and remove/fix anything inappropriate for production.

Verify:

AUTH:
Registration works.
Login works.
Logout works.
Passwords are hashed.
Protected routes work.

DASHBOARD:
Uses real database data.
No fake statistics.

UPLOAD:
Works.
Validation works.
Storage works.
Ownership checks work.

AI:
Replicate integration is real.
API key is backend-only.
Background removal works.
Failed jobs are handled.
Successful jobs persist results.
Credits are correctly handled.

PROCESSING:
Resize works.
Crop works.
Aspect ratios work.
Original remains intact.
Versions are stored.

CREDITS:
Balance persists.
Transactions persist.
Duplicate deduction is prevented.
Failed operations don't permanently consume credits.

ADMIN:
Admin access is protected server-side.
Normal users cannot access admin APIs.

SECURITY:
No secrets committed.
No API keys exposed.
CORS configured.
Authentication enforced.
Authorization enforced.
Uploads validated.

DEPLOYMENT:
Production build succeeds.
Migrations work.
Environment variables documented.
Docker works.
Domain configuration documented.

UX:
Desktop works.
Mobile works.
Loading states exist.
Error states exist.
Empty states exist.
Success states exist.

SEO:
Metadata exists.
Sitemap exists.
Robots exists.
Canonical URLs exist.
OpenGraph exists.

==================================================
33. IMPORTANT SCOPE RULE
========================

This is Phase 1.

DO NOT spend time fully implementing:

* Advanced AI generation
* Object removal
* Advanced inpainting
* Outpainting
* Advanced upscaling
* Social media automation
* Batch processing
* Advanced image editor
* Complex subscription management
* Mobile application
* Enterprise features

However, the architecture must make these features easy to add later.

Phase 1 must be excellent at:

UPLOAD
→ AI BACKGROUND REMOVAL
→ PREVIEW
→ CROP/RESIZE
→ DOWNLOAD
→ HISTORY
→ CREDITS

==================================================
34. QUALITY STANDARD
====================

Write clean, maintainable, production-quality code.

Do not over-engineer.

Do not create unnecessary abstractions.

Do not create enormous components.

Do not duplicate code.

Do not use fake data for real application functionality.

Do not use placeholder APIs.

Do not expose credentials.

Do not claim a feature is complete until it actually works.

Prioritize reliability over flashy animations.

The UI should look like a serious commercial SaaS product.

==================================================
35. FINAL REPORT
================

When everything is complete, provide a final report containing:

1. What was built.
2. Architecture.
3. Tech stack.
4. Database structure.
5. AI provider.
6. AI API configuration.
7. Credit system.
8. Authentication.
9. Admin system.
10. Stripe foundation.
11. SEO implementation.
12. Deployment instructions.
13. Environment variables required.
14. Tests performed.
15. Security checks performed.
16. Remaining Phase 2 work.
17. Exact commands to run locally.
18. Exact production deployment commands.
19. Phase 1 acceptance criteria checklist.

Do not declare the project complete until the application builds successfully and the critical workflows have been tested.

START NOW.

First inspect the repository and available design/reference assets.

Then create the architecture and begin implementation.

Do not ask me to manually create files that you can create yourself.

If credentials, API keys, domain access, or third-party accounts are required and unavailable, create the correct integration/configuration and clearly identify the exact credential that I need to provide, but continue implementing everything else that does not require that credential.

Use sensible secure defaults.

Build Photopol as a real product.
