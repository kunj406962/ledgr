import React from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

export const Info = () => {
    return(
        <div className="hidden md:flex md:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <div>
          <div className="mono text-4xl font-bold text-accent-primary mb-6">
            LEDGR
          </div>
          <h1 className="text-4xl font-semibold text-text-primary mb-4">
            Premium Financial Intelligence
          </h1>
          <p className="text-lg text-text-secondary max-w-md">
            ML-powered insights for sophisticated financial management. 
            Track accounts, predict spending, and optimize your cashflow.
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="mono text-accent-primary font-bold">ML</span>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">AI-Powered Predictions</h3>
              <p className="text-sm text-text-secondary">
                Advanced machine learning models forecast your spending and detect anomalies
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent-secondary/10 flex items-center justify-center flex-shrink-0">
              <span className="mono text-accent-secondary font-bold">∞</span>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Unlimited Accounts</h3>
              <p className="text-sm text-text-secondary">
                Connect all your bank accounts, credit cards, and investment portfolios
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-elevated flex items-center justify-center flex-shrink-0">
              <span className="mono text-text-primary font-bold">🔒</span>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Privacy First</h3>
              <p className="text-sm text-text-secondary">
                All data processing happens locally. Your financial data never leaves your device
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-8 border-t border-border">
          <p className="text-xs text-text-secondary">
            © 2026 Ledgr. Premium SaaS Fintech.
          </p>
          <ThemeToggle />
        </div>
      </div>
    )
}