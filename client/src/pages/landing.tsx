import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartLine, Shield, Zap, Eye, CreditCard, TrendingDown } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <ChartLine className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-primary">Xelia</h1>
            </div>
            <Button 
              onClick={() => window.location.href = '/login'}
              className="bg-primary text-white hover:bg-gray-800"
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-primary mb-6">
            Take Control of Your
            <span className="block text-debt-red">Debt Journey</span>
          </h2>
          <p className="text-xl text-secondary max-w-3xl mx-auto mb-8">
            Get a clear, consolidated view of all your debt accounts and interest rates. 
            No complex features, no overwhelming interfaces—just the clarity you need.
          </p>
          <Button 
            size="lg"
            onClick={() => window.location.href = '/register'}
            className="bg-primary text-white hover:bg-gray-800 text-lg px-8 py-4"
            data-testid="button-hero-signup"
          >
            Start Managing Your Debt
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-primary text-center mb-12">
            Simple. Transparent. Effective.
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-blue-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <Eye className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">Clear Visibility</h4>
                <p className="text-secondary">
                  See all your debt accounts in one place with automatic bank integration
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-green-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <Shield className="h-8 w-8 text-debt-green" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">Bank-Level Security</h4>
                <p className="text-secondary">
                  Your data is protected with the same encryption used by major banks
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-amber-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <Zap className="h-8 w-8 text-debt-amber" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">Instant Setup</h4>
                <p className="text-secondary">
                  Connect your accounts in under 2 minutes and get immediate insights
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-red-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-debt-red" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">All Debt Types</h4>
                <p className="text-secondary">
                  Credit cards, loans, mortgages—track every type of debt in one dashboard
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-purple-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <TrendingDown className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">Smart Insights</h4>
                <p className="text-secondary">
                  Understand your weighted average rates and prioritize high-interest debt
                </p>
              </CardContent>
            </Card>

            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="bg-indigo-50 p-3 rounded-lg w-fit mx-auto mb-4">
                  <ChartLine className="h-8 w-8 text-indigo-600" />
                </div>
                <h4 className="text-xl font-semibold text-primary mb-3">Read-Only Access</h4>
                <p className="text-secondary">
                  We can only view your account info—never make changes or payments
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to get clarity on your debt?
          </h3>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of users who have taken control of their financial future
          </p>
          <Button 
            size="lg"
            variant="secondary"
            onClick={() => window.location.href = '/register'}
            className="bg-white text-primary hover:bg-gray-100 text-lg px-8 py-4"
            data-testid="button-cta-signup"
          >
            Get Started for Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <ChartLine className="h-6 w-6 mr-2" />
            <span className="text-lg font-semibold">Xelia</span>
          </div>
          <p className="text-gray-400">
            Simple debt management for a clearer financial future
          </p>
        </div>
      </footer>
    </div>
  );
}
