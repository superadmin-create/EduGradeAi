import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  GraduationCap, 
  LayoutDashboard, 
  Upload, 
  FileText, 
  Users, 
  BarChart3, 
  Settings 
} from "lucide-react";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: FileText },
  { href: "/upload", label: "Upload Submission", icon: Upload },
  { href: "/submissions", label: "Student Submissions", icon: Users },
  { href: "/grading-results", label: "Grading Results", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="sidebar w-64 text-white shadow-lg flex-shrink-0">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <GraduationCap className="text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Grader</h1>
            <p className="text-sm opacity-80">Assignment Management</p>
          </div>
        </div>
      </div>
      
      <nav className="px-4 pb-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "navigation-item flex items-center space-x-3 px-4 py-3 rounded-lg mb-2",
                isActive && "active"
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
