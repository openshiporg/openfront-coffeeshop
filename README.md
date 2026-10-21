# Openfront Coffee Shop

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopenshiporg%2Fopenfront-coffee-shop&env=DATABASE_URL%2CSESSION_SECRET)

Openfront Coffee Shop is a self-hostable cafe ordering and operations application. Customers can browse the menu, order for pickup, and review their orders. Cafe teams manage counter orders, production queues, payments, recipes, inventory, loyalty, catering, and shifts.

## Demo

![Drink image included with the Coffee Shop menu](public/images/vanilla-latte.jpg)

Explore the application locally using the setup instructions below.

| | |
|---|---|
| **Public application** | `/` on your development URL |
| **Dashboard** | `/dashboard` on your development URL |

[Learn more →](https://openship.org/products/openfront-coffee-shop)

[Documentation →](https://docs.openship.org/docs/openfront/coffee-shop/)

## The Openfront Ecosystem

Openfront is part of an ecosystem of open-source commerce tools:

- **[Openfront E-commerce](https://github.com/openshiporg/openfront)**: Headless e-commerce for retail.
- **[Openfront Restaurant](https://github.com/openshiporg/openfront-restaurant)**: Restaurant ordering, point of sale, and kitchen operations.
- **[Openship](https://github.com/openshiporg/openship)**: Order routing for multi-channel fulfillment.
- **Openfront Coffee Shop**: (This repository) a self-hostable cafe ordering and operations application.

## Core Features

### Admin Dashboard
Manage kds, store settings, coffee operations, pos, menu, orders, reports through dedicated dashboard workspaces and permission-controlled data screens.

### Storefront
The public menu connects item detail pages at `/menu/[id]` to `/checkout`, `/order-confirmed`, and `/account`. Order acceptance, payment, and production progress are separate workflow steps.

### POS & Kitchen Display
Manage cafe and counter orders, item production states, register shifts, cash movements, and staff shifts. The kitchen display has its own production and recovery authority checks.

### Recipes & Inventory
Track ingredients, recipes, inventory items and lots, purchase orders, prep batches, stock consumption, and waste.

### Payments & Retention
Record payments and refunds, manage loyalty accounts and events, and update catering orders and subscriptions. Online checkout uses configured Stripe or PayPal adapters; manual payment recording is operator-only.

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 with App Router and React 19.
- **Backend**: KeystoneJS 6 with a GraphQL API.
- **Database**: PostgreSQL with Prisma ORM.
- **Styling**: Tailwind CSS 4 and shared shadcn/ui components.
- **Authentication**: Password-based user accounts and session-based access with role capabilities.

### Application Structure
```text
openfront-coffee-shop/
├── app/                    # Public pages, dashboard routes, and HTTP endpoints
├── features/
│   ├── keystone/           # Backend models, access rules, and GraphQL workflows
│   ├── platform/           # Operator workspaces and onboarding
│   ├── storefront/         # Public application components and screens
│   └── dashboard/          # Authentication and shared dashboard shell
└── components/             # Shared UI components
```

### Data Models
The [model registry](features/keystone/models/index.ts) and [Prisma schema](schema.prisma) cover:

- Menu categories, items, images, modifiers, and store settings.
- Cafe orders, order items, POS orders, payments, events, and providers.
- Ingredients, recipes, prep batches, lots, suppliers, purchasing, and stock movements.
- Loyalty accounts, catering orders, subscriptions, register shifts, cash movements, and staff shifts.

## Getting Started

### Prerequisites
- Node.js 22, compatible with the [package requirements](package.json) and Next.js 16.
- A PostgreSQL database you can migrate.
- npm.

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/openshiporg/openfront-coffee-shop.git
   cd openfront-coffee-shop
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Review the [example configuration](.env.example) and replace its placeholders. Keep only the local settings you need; do not copy production-mode or infrastructure examples unchanged.

   ```env
   DATABASE_URL=postgresql://user:password@host/database
   SESSION_SECRET=replace-with-a-new-private-random-secret
   ```

   Generate the session secret with `openssl rand -hex 32`; use the generated value, not the placeholder. Never commit `.env`.

   Review [runtime configuration](features/keystone/index.ts) for additional application settings before building or deploying. Configure enabled integrations separately; the two values above are not a complete production configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The development script prepares the backend schema, applies checked-in migrations, and starts Next.js.

4. **Access the application:**
   Open the URL `npm run dev` prints, then use these paths:

   - **Public application**: `/`
   - **Admin dashboard**: `/dashboard`
   - **GraphQL API**: `/api/graphql`

5. **Create your first admin user:**
   Visit `/dashboard/init` on an empty database to create the initial administrator, then sign in to the dashboard.

6. **Run application onboarding:**
   Use cafe onboarding to configure store details and menu data. Review modifiers, prices, payment providers, production stations, and inventory before accepting orders.

## Development Commands

- `npm run dev` - Prepare the backend schema, apply migrations, and start Next.js development.
- `npm run build` - Build the backend and Next.js for production; does not apply migrations.
- `npm start` - Start the production Next.js server.
- `npm run migrate:gen` - Prepare the schema and generate/apply development migrations.
- `npm run migrate` - Apply checked-in Prisma migrations.
- `npm run lint` - Run the repository's ESLint script.
- `npm run typecheck` - Run the configured TypeScript check.
- `npm run test` - Run the repository's configured test suite.

Use a disposable development database for migration generation. Review the script before running it against any existing data.

### Payment Integration
The [payment loader](features/integrations/payment/index.ts) registers Stripe, PayPal, and manual adapters. Public checkout accepts only configured online providers; offline records cannot settle customer checkout.

## Documentation

See the [Openfront Coffee Shop documentation](https://docs.openship.org/docs/openfront/coffee-shop/) for the application guide. The [backend models](features/keystone/models), [registered business workflows](features/keystone/mutations/index.ts), [access rules](features/keystone/access.ts), and [application routes](app) document the implementation in this repository.

## Security & Permissions

### Role-Based Access Control
- `canAccessDashboard` - Access dashboard.
- `canManageOrders` - Manage orders.
- `canManagePayments` - Manage payments.
- `canManageProducts` - Manage products.
- `canManageInventory` - Manage inventory.
- `canManageLoyalty` - Manage loyalty.

### Security Features
- Session-based authentication for signed-in users.
- Backend list access and workflow authorization, rather than dashboard visibility alone.
- Order, payment, product, inventory, and loyalty access have distinct read and manage capabilities. Customer queries and KDS workflows use their own authorization paths.

Review the [access implementation](features/keystone/access.ts) and individual workflow checks before extending permissions.

## Platform Components

### Admin Platform (`/dashboard`)
- **Kds**: `/dashboard/platform/kds`.
- **Store Settings**: `/dashboard/platform/store-settings`.
- **Coffee Operations**: `/dashboard/platform/coffee-operations`.
- **Pos**: `/dashboard/platform/pos`.
- **Menu**: `/dashboard/platform/menu`.
- **Orders**: `/dashboard/platform/orders`.
- **Reports**: `/dashboard/platform/reports`.

### Storefront Experience
The public menu connects item detail pages at `/menu/[id]` to `/checkout`, `/order-confirmed`, and `/account`. Order acceptance, payment, and production progress are separate workflow steps.

Manage cafe and counter orders, item production states, register shifts, cash movements, and staff shifts. The kitchen display has its own production and recovery authority checks.

## Deployment

### Production Deployment
The Vercel button imports this application's own repository. Provision PostgreSQL and configure the application's complete runtime requirements, storage, mail, and enabled providers before building. Importing the source does not configure these services.

Build the application and apply checked-in migrations as a release step before starting the server. Back up existing data before migration.

```bash
npm run build
npm run migrate
npm start
```

The included [Railway configuration](railway.toml) defines this app's build and startup lifecycle. Provision services and secrets separately.

### Scaling Considerations
Keep the shared PostgreSQL database, session secrets, and configured object storage consistent across application processes. Review background delivery and integration requirements before choosing a serverless runtime; a source import does not supply persistent workers.

## Contributing

Use the development commands above when preparing changes. Keep model changes and their migrations together, and describe workflow and permission changes in pull requests.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## Support

- **Documentation**: [Openfront Coffee Shop guide](https://docs.openship.org/docs/openfront/coffee-shop/).
- **Issues**: [Report bugs and feature requests](https://github.com/openshiporg/openfront-coffee-shop/issues).
- **Product**: [Learn more about Openfront Coffee Shop](https://openship.org/products/openfront-coffee-shop).

---

Built with [Next.js](https://nextjs.org) and [KeystoneJS](https://keystonejs.com).
