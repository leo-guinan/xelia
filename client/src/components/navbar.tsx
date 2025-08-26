import { useState } from "react";
import { ChartLine, Plus, User, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import AddAccountModal from "@/components/add-account-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const { user } = useAuth();

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <ChartLine className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-primary">ClearDebt</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => setIsAddAccountModalOpen(true)}
                className="bg-primary text-white hover:bg-gray-800"
                data-testid="button-add-account"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center text-sm text-secondary hover:text-primary"
                    data-testid="button-user-menu"
                  >
                    <User className="h-5 w-5 mr-2" />
                    <span>{displayName}</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem 
                    onClick={() => window.location.href = '/api/logout'}
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      
      <AddAccountModal 
        isOpen={isAddAccountModalOpen} 
        onClose={() => setIsAddAccountModalOpen(false)} 
      />
    </>
  );
}
