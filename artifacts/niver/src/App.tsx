import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';

import Landing from '@/pages/landing';
import Guests from '@/pages/guests';
import Forum from '@/pages/forum';
import Event from '@/pages/event';
import Gallery from '@/pages/gallery';
import Profile from '@/pages/profile';
import Admin from '@/pages/admin';
import Invite from '@/pages/invite';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/evento" component={Event} />
        <Route path="/convidados" component={Guests} />
        <Route path="/forum" component={Forum} />
        <Route path="/fotos" component={Gallery} />
        <Route path="/perfil" component={Profile} />
        <Route path="/admin" component={Admin} />
        <Route path="/i/:token" component={Invite} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
