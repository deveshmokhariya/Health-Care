import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-base selection:bg-teal-200 selection:text-teal-900">
      <Outlet />
    </div>
  ),
})
