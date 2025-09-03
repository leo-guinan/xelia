import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChartLine, Check, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

// Password validation schema matching backend requirements
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must not exceed 128 characters")
  .refine(
    (password) => /[@$!%*?&#^()_+=\-{}\[\]|\\:";'<>,.?\/~`]/.test(password),
    "Password must contain at least one special character"
  );

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireSpecialChar: boolean;
  specialChars: string;
  message: string;
}

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  const password = form.watch("password");

  // Fetch password requirements from backend
  useEffect(() => {
    fetch("/api/auth/password-requirements")
      .then(res => res.json())
      .then(data => setPasswordRequirements(data))
      .catch(err => console.error("Failed to fetch password requirements:", err));
  }, []);

  // Check password requirements in real-time
  const checkPasswordRequirements = (pwd: string) => {
    if (!passwordRequirements) return { length: false, special: false };
    
    return {
      length: pwd.length >= passwordRequirements.minLength,
      special: /[@$!%*?&#^()_+=\-{}\[\]|\\:";'<>,.?\/~`]/.test(pwd),
    };
  };

  const passwordChecks = checkPasswordRequirements(password);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Check if there are password requirement errors
        if (result.passwordRequirements && result.passwordRequirements.length > 0) {
          const requirements = result.passwordRequirements.join(", ");
          throw new Error(`Password requirements: ${requirements}`);
        }
        throw new Error(result.message || "Registration failed");
      }

      toast({
        title: "Success",
        description: "Account created successfully",
      });

      // Reload to update auth state
      window.location.href = "/";
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <ChartLine className="h-10 w-10 text-primary mr-3" />
          <h1 className="text-2xl font-bold text-primary">Xelia</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Get started with your debt management journey</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Doe"
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                        />
                      </FormControl>
                      <FormMessage />
                      
                      {/* Password Requirements Display */}
                      {(passwordFocused || password.length > 0) && passwordRequirements && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-2">Password requirements:</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              {passwordChecks.length ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span className={passwordChecks.length ? "text-green-700" : "text-gray-600"}>
                                At least {passwordRequirements.minLength} characters
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {passwordChecks.special ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span className={passwordChecks.special ? "text-green-700" : "text-gray-600"}>
                                At least one special character
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Special characters: {passwordRequirements.specialChars}
                          </p>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !passwordChecks.length || !passwordChecks.special}
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </Form>

            <div className="mt-4 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}