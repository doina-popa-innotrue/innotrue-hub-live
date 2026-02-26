import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  WHEEL_OF_LIFE_CATEGORIES,
  WHEEL_CATEGORY_DESCRIPTIONS,
  WheelCategory,
} from "@/lib/wheelOfLifeCategories";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Target,
  Mail,
  Download,
  UserPlus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  Rocket,
  TrendingUp,
  Crown,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import { generateWheelPdf } from "@/lib/wheelPdfExport";

const emailSchema = z.string().email("Please enter a valid email address");

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string;
  tier_level: number;
}

const PLANS: Plan[] = [
  {
    id: "free",
    key: "free",
    name: "Free",
    description: "Get started with InnoTrue Hub and explore how structured development works.",
    tier_level: 1,
  },
  {
    id: "base",
    key: "base",
    name: "Base",
    description: "Understand your direction, strengths, and next steps before committing deeper.",
    tier_level: 2,
  },
  {
    id: "pro",
    key: "pro",
    name: "Pro",
    description:
      "Your system for lifelong development with learning, assessment, and progress tracking.",
    tier_level: 3,
  },
  {
    id: "advanced",
    key: "advanced",
    name: "Advanced",
    description: "For timeframes of deeper focus with increased intensity.",
    tier_level: 4,
  },
  {
    id: "elite",
    key: "elite",
    name: "Elite",
    description: "For high-stakes phases: exams, transitions, or critical career moments.",
    tier_level: 5,
  },
];

type Step = "questionnaire" | "email" | "results" | "plans";

export default function WheelAssessment() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("questionnaire");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [name, setName] = useState("");
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  const [ratings, setRatings] = useState<Record<WheelCategory, number>>(() => {
    const initial: Record<WheelCategory, number> = {} as Record<WheelCategory, number>;
    (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).forEach((cat) => {
      initial[cat] = 5;
    });
    return initial;
  });

  const getChartData = () => {
    return (Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).map((cat) => ({
      category: WHEEL_OF_LIFE_CATEGORIES[cat],
      value: ratings[cat] || 0,
      fullMark: 10,
    }));
  };

  const getAverageScore = () => {
    const values = Object.values(ratings);
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  const getLowestCategories = () => {
    return Object.entries(ratings)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 3)
      .map(([cat]) => WHEEL_OF_LIFE_CATEGORIES[cat as WheelCategory]);
  };

  const handleEmailSubmit = async () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError("");

    setSending(true);
    try {
      // Save to ac_signup_intents via edge function (public page — no auth token)
      const { error } = await supabase.functions.invoke("submit-wheel-intent", {
        body: {
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          ratings,
          notes,
          subscribe_newsletter: subscribeNewsletter,
        },
      });

      if (error) {
        console.error("Error saving intent:", error);
      }

      // Send PDF via email
      const { error: emailError } = await supabase.functions.invoke("send-wheel-pdf", {
        body: {
          email: email.trim().toLowerCase(),
          name: name.trim() || "Friend",
          ratings,
          notes,
        },
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        toast({
          title: "Email sending failed",
          description: "We couldn't send the PDF to your email, but you can still download it.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "PDF sent!",
          description: `We've sent your Wheel of Life results to ${email}`,
        });
      }

      setStep("results");
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await generateWheelPdf(name || "Your", ratings, notes);
      toast({
        title: "PDF Downloaded",
        description: "Your Wheel of Life results have been saved.",
      });
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSignUp = async () => {
    setSigningUp(true);
    try {
      // Update the signup intent with plan interest via edge function
      if (selectedPlan) {
        await supabase.functions.invoke("submit-wheel-intent", {
          body: {
            email: email.trim().toLowerCase(),
            name: name.trim() || null,
            ratings,
            notes,
            subscribe_newsletter: subscribeNewsletter,
            plan_interest: selectedPlan,
          },
        });
      }

      // Navigate to auth page with prefilled data
      const params = new URLSearchParams({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        wheel_completed: "true",
        plan_interest: selectedPlan || "",
      });

      navigate(`/auth?${params.toString()}`);
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningUp(false);
    }
  };

  const getPlanIcon = (planKey: string) => {
    switch (planKey) {
      case "free":
        return <Zap className="h-5 w-5" />;
      case "base":
        return <Sparkles className="h-5 w-5" />;
      case "pro":
        return <Rocket className="h-5 w-5" />;
      case "advanced":
        return <TrendingUp className="h-5 w-5" />;
      case "elite":
        return <Crown className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Wheel of Life Assessment</h1>
          <p className="text-muted-foreground text-lg">
            Discover your life balance across 10 key areas
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            {["questionnaire", "email", "results", "plans"].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    step === s
                      ? "bg-primary"
                      : ["questionnaire", "email", "results", "plans"].indexOf(step) > idx
                        ? "bg-primary/60"
                        : "bg-muted-foreground/30"
                  }`}
                />
                {idx < 3 && (
                  <div
                    className={`w-8 h-0.5 ${
                      ["questionnaire", "email", "results", "plans"].indexOf(step) > idx
                        ? "bg-primary/60"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step: Questionnaire */}
        {step === "questionnaire" && (
          <Card>
            <CardHeader>
              <CardTitle>Rate Your Life Balance</CardTitle>
              <CardDescription>
                On a scale of 1-10, how satisfied are you in each area of your life?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {(Object.keys(WHEEL_OF_LIFE_CATEGORIES) as WheelCategory[]).map((cat) => (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="font-medium">{WHEEL_OF_LIFE_CATEGORIES[cat]}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {WHEEL_CATEGORY_DESCRIPTIONS[cat]}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {ratings[cat]}
                      </Badge>
                    </div>
                    <Slider
                      value={[ratings[cat]]}
                      onValueChange={([value]) => setRatings((prev) => ({ ...prev, [cat]: value }))}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any thoughts about your current life balance..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep("email")} size="lg">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Email Collection */}
        {step === "email" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Get Your Results
              </CardTitle>
              <CardDescription>
                Enter your email to receive your personalized Wheel of Life PDF report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name (optional)</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={emailError ? "border-destructive" : ""}
                  />
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="newsletter"
                    checked={subscribeNewsletter}
                    onCheckedChange={(checked) => setSubscribeNewsletter(checked === true)}
                  />
                  <Label
                    htmlFor="newsletter"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Keep me updated with tips on personal development
                  </Label>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("questionnaire")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleEmailSubmit} disabled={sending || !email}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send My Results
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Results */}
        {step === "results" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Wheel of Life Results</CardTitle>
                <CardDescription>Here's a snapshot of your current life balance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={getChartData()}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.5}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-primary/10">
                      <p className="text-sm text-muted-foreground">Average Score</p>
                      <p className="text-3xl font-bold text-primary">{getAverageScore()}/10</p>
                    </div>

                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-muted-foreground mb-2">
                        Areas with most growth potential:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getLowestCategories().map((cat) => (
                          <Badge key={cat} variant="secondary">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleDownloadPdf}
                        variant="outline"
                        disabled={downloadingPdf}
                      >
                        {downloadingPdf ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button onClick={() => setStep("plans")} size="lg">
                Explore Development Plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Plans */}
        {step === "plans" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Choose Your Development Path</h2>
              <p className="text-muted-foreground">
                Select a plan that fits your goals and commitment level
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PLANS.filter((p) => p.key !== "free").map((plan) => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedPlan === plan.key ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => setSelectedPlan(plan.key)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {getPlanIcon(plan.key)}
                      </div>
                      {selectedPlan === plan.key && <Check className="h-5 w-5 text-primary" />}
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Ready to start your journey?</h3>
                    <p className="text-sm text-muted-foreground">
                      Your Wheel of Life results will be saved to your account
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep("results")}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button onClick={handleSignUp} disabled={signingUp}>
                      {signingUp ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      Create Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="link" onClick={() => navigate("/")}>
                Just browsing? Return to homepage
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
