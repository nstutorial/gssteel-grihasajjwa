import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Wallet } from "lucide-react";

export const AuthTabs = () => {
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <Card className="w-full max-w-md shadow-xl border-0">
      <CardHeader className="text-center space-y-4 pb-8">
        <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
          <Wallet className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Welcome to Griha Sajjwa</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Track your expenses and manage lending with interest calculations
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input 
                id="signin-email" 
                type="email" 
                placeholder="Enter your email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input 
                id="signin-password" 
                type="password" 
                placeholder="Enter your password"
                className="h-11"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me
              </label>
            </div>
            <Button className="w-full h-11" size="lg">
              Sign In
            </Button>
            <div className="text-center">
              <button className="text-sm text-primary hover:underline">
                Forgot Password?
              </button>
            </div>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input 
                id="signup-name" 
                type="text" 
                placeholder="Enter your full name"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input 
                id="signup-email" 
                type="email" 
                placeholder="Enter your email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input 
                id="signup-password" 
                type="password" 
                placeholder="Create a password"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-confirm">Confirm Password</Label>
              <Input 
                id="signup-confirm" 
                type="password" 
                placeholder="Confirm your password"
                className="h-11"
              />
            </div>
            <Button className="w-full h-11" size="lg">
              Sign Up
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
