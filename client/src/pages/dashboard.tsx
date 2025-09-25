import StatsCards from "@/components/dashboard/stats-cards";
import AssignmentUpload from "@/components/dashboard/assignment-upload";
import QuestionAnswerForm from "@/components/dashboard/question-answer-form";
import RecentAssignments from "@/components/dashboard/recent-assignments";
import GradingStatus from "@/components/dashboard/grading-status";
import BatchUpload from "@/components/dashboard/batch-upload";
import { useState } from "react";

export default function Dashboard() {
  const [questions, setQuestions] = useState([
    {
      id: "1",
      question: "What are the key principles of object-oriented programming?",
      expectedAnswer: "The four key principles are: Encapsulation, Inheritance, Polymorphism, and Abstraction...",
      points: 10,
    },
  ]);

  return (
    <div className="space-y-6">
      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssignmentUpload />
        <QuestionAnswerForm questions={questions} onChange={setQuestions} />
      </div>

      <RecentAssignments />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GradingStatus />
        <BatchUpload />
      </div>
    </div>
  );
}
