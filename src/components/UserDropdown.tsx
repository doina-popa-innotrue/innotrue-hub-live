import { Settings, LogOut, UserX, Trash2, User, Globe, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserDropdownProps {
  profileName: string;
  avatarUrl: string | null;
  email: string | undefined;
  planName: string | null;
}

export function UserDropdown({ profileName, avatarUrl, email, planName }: UserDropdownProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getInitials = () => {
    if (!profileName) return email?.charAt(0).toUpperCase() || "U";
    return profileName.charAt(0).toUpperCase();
  };

  const handleRequestDeactivation = async () => {
    setSubmitting(true);
    try {
      // Send email to admins requesting deactivation
      const { error } = await supabase.functions.invoke("send-notification-email", {
        body: {
          email: "admin@evolve360hub.com", // This will be handled by the edge function to send to all admins
          name: "Admin",
          type: "account_deactivation_request",
          timestamp: new Date().toISOString(),
          userName: profileName,
          userEmail: email,
          userId: user?.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Request submitted",
        description: "Your account deactivation request has been sent to the administrators.",
      });
      setDeactivateDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDeletion = async () => {
    setSubmitting(true);
    try {
      // Submit deletion request via edge function
      const { data, error } = await supabase.functions.invoke("request-account-deletion", {
        body: {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Request submitted",
        description:
          "Your account deletion request has been submitted. You will receive a confirmation email shortly.",
      });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-medium">{profileName || email}</span>
              {planName && (
                <span className="text-xs text-white/60">{planName}</span>
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background border border-border z-50">
          <DropdownMenuItem onClick={() => navigate("/account")} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            InnoTrue Hub Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/public-profile")} className="cursor-pointer">
            <Globe className="mr-2 h-4 w-4" />
            Public Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/subscription")} className="cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscription
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeactivateDialogOpen(true)}
            className="cursor-pointer text-muted-foreground"
          >
            <UserX className="mr-2 h-4 w-4" />
            Request Deactivation
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Request Deletion
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Account Deactivation</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a request to administrators to temporarily deactivate your account.
              Your data will be preserved and you can still log in to reactivate your account at any
              time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestDeactivation}
              disabled={submitting}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Account Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a request to administrators to permanently delete your account. Once
              deleted, all your data including programs, progress, decisions, and goals will be
              permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestDeletion}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Submitting..." : "Submit Deletion Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
