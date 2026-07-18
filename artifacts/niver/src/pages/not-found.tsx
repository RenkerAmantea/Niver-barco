import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 bg-background/40 border-white/10 backdrop-blur-xl">
        <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-6" />
          <h1 className="text-3xl font-display font-bold text-foreground mb-3">404</h1>
          <p className="text-muted-foreground mb-8 text-lg">A página que você está procurando não existe ou foi movida.</p>
          <Button asChild size="lg" className="w-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">
            <Link href="/">Voltar para o início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
