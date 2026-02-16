import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Download, Mail, ArrowRight, ArrowLeft, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import { PageLoadingState } from "@/components/ui/page-loading-state";
import { ErrorState } from "@/components/ui/error-state";

const emailSchema = z.string().email("Please enter a valid email address");

type Question = {
  id: string;
  question_text: string;
  order_index: number;
};

type Option = {
  id: string;
  question_id: string;
  option_text: string;
  order_index: number;
};

type Dimension = {
  name: string;
  description: string | null;
};

type Interpretation = {
  name: string;
  interpretation_text: string;
};

type Step = "intro" | "questions" | "email" | "results";

export default function PublicAssessment() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dimensionScores, setDimensionScores] = useState<Record<string, number>>({});
  const [matchedInterpretations, setMatchedInterpretations] = useState<Interpretation[]>([]);

  // Fetch assessment
  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ["public-assessment", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_definitions")
        .select("*")
        .eq("slug", slug ?? "")
        .eq("is_active", true)
        .eq("is_public", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch questions
  const { data: questions = [] } = useQuery({
    queryKey: ["public-assessment-questions", assessment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_questions")
        .select("*")
        .eq("assessment_id", assessment?.id ?? "")
        .order("order_index");
      if (error) throw error;
      return data as Question[];
    },
    enabled: !!assessment?.id,
  });

  // Fetch options
  const { data: options = [] } = useQuery({
    queryKey: ["public-assessment-options", assessment?.id],
    queryFn: async () => {
      const questionIds = questions.map((q) => q.id);
      if (questionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_options")
        .select("*")
        .in("question_id", questionIds)
        .order("order_index");
      if (error) throw error;
      return data as Option[];
    },
    enabled: questions.length > 0,
  });

  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  const currentQuestion = questions[currentQuestionIndex];
  const currentOptions = options.filter((o) => o.question_id === currentQuestion?.id);
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const allAnswered = questions.every((q) => answers[q.id]);

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setStep("email");
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleEmailSubmit = async () => {
    try {
      emailSchema.parse(email);
      setEmailError("");
    } catch {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: result, error } = await supabase.functions.invoke(
        "compute-assessment-scores",
        {
          body: {
            assessment_id: assessment?.id,
            answers,
            email,
            name: name || null,
            newsletter_consent: newsletterConsent,
          },
        }
      );

      if (error) throw error;

      setDimensionScores(result.dimension_scores);
      setDimensions(result.dimensions);
      setMatchedInterpretations(result.interpretations);
      setStep("results");
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit assessment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(assessment?.name || "Assessment Results", pageWidth / 2, y, { align: "center" });
    y += 15;

    // User info
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Name: ${name || "Not provided"}`, 20, y);
    y += 8;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y);
    y += 15;

    // Dimension Scores
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Your Scores", 20, y);
    y += 10;

    doc.setFontSize(11);
    Object.entries(dimensionScores).forEach(([name, score]) => {
      doc.setTextColor(60, 60, 60);
      doc.text(`${name}: ${score}`, 25, y);
      y += 7;
    });
    y += 10;

    // Interpretations
    if (matchedInterpretations.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Your Profile", 20, y);
      y += 10;

      matchedInterpretations.forEach((int) => {
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(int.name, 25, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const lines = doc.splitTextToSize(int.interpretation_text, pageWidth - 50);
        lines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 25, y);
          y += 5;
        });
        y += 8;
      });
    }

    doc.save(`${assessment?.slug || "assessment"}-results.pdf`);
  };

  if (assessmentLoading) {
    return <PageLoadingState />;
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <ErrorState title="Not Found" description="This assessment doesn't exist or is not currently available." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{assessment.name}</h1>
          {assessment.description && (
            <p className="text-muted-foreground">{assessment.description}</p>
          )}
        </div>

        {/* Intro */}
        {step === "intro" && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
              <CardDescription>
                {questions.length} questions · Takes about {Math.ceil(questions.length * 0.5)}{" "}
                minutes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assessment.instructions && (
                <p className="text-muted-foreground">{assessment.instructions}</p>
              )}
              <Button onClick={() => setStep("questions")} className="w-full">
                Start Assessment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Questions */}
        {step === "questions" && currentQuestion && (
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <h2 className="text-lg font-medium">{currentQuestion.question_text}</h2>

              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => setAnswers({ ...answers, [currentQuestion.id]: value })}
              >
                <div className="space-y-3">
                  {currentOptions.map((opt) => (
                    <div key={opt.id} className="flex items-start space-x-3">
                      <RadioGroupItem value={opt.id} id={opt.id} className="mt-1" />
                      <Label htmlFor={opt.id} className="font-normal cursor-pointer">
                        {opt.option_text}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              <div className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={!answers[currentQuestion.id]}>
                  {currentQuestionIndex === questions.length - 1 ? "Continue" : "Next"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email */}
        {step === "email" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Almost Done!
              </CardTitle>
              <CardDescription>
                Enter your details to receive your personalized results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="your@email.com"
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="newsletter"
                  checked={newsletterConsent}
                  onCheckedChange={(checked) => setNewsletterConsent(checked === true)}
                />
                <Label htmlFor="newsletter" className="text-sm font-normal cursor-pointer">
                  I'd like to receive tips and insights to support my development
                </Label>
              </div>
              <Button onClick={handleEmailSubmit} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Get My Results
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {step === "results" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Results</CardTitle>
                <CardDescription>
                  Based on your responses, here's your personalized profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dimension Scores */}
                <div>
                  <h3 className="font-medium mb-3">Your Scores</h3>
                  <div className="grid gap-3">
                    {Object.entries(dimensionScores).map(([dimName, score]) => {
                      const dim = dimensions.find((d) => d.name === dimName);
                      const maxPossible = questions.length * 5; // Assuming max score per question is 5
                      const percentage = Math.min((score / maxPossible) * 100, 100);
                      return (
                        <div key={dimName} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{dimName}</span>
                            <span className="font-medium">{score}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          {dim?.description && (
                            <p className="text-xs text-muted-foreground">{dim.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interpretations */}
                {matchedInterpretations.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Your Profile Insights</h3>
                    <div className="space-y-4">
                      {matchedInterpretations.map((int, idx) => (
                        <div key={idx} className="p-4 bg-muted/50 rounded-lg">
                          <Badge className="mb-2">{int.name}</Badge>
                          <p className="text-sm">{int.interpretation_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matchedInterpretations.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Your unique combination of responses shows a balanced profile across all
                    dimensions.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleDownloadPdf} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={() => navigate("/auth?signup=true")} className="flex-1">
                Join the Hub
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
