import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { Plus, Trash2 } from "lucide-react";

interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  points: number;
}

interface QuestionAnswerFormProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export default function QuestionAnswerForm({ questions, onChange }: QuestionAnswerFormProps) {
  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      question: "",
      expectedAnswer: "",
      points: 10,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: string | number) => {
    const updated = questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    onChange(updated);
  };

  const removeQuestion = (id: string) => {
    const filtered = questions.filter(q => q.id !== id);
    onChange(filtered);
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Answer Key</h3>
        <Button 
          onClick={addQuestion}
          variant="outline"
          size="sm"
          data-testid="button-add-question"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      </div>
      
      {questions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No questions added yet. Click "Add Question" to get started.</p>
        </div>
      )}

      <div className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">Question {index + 1}</h4>
              <Button
                onClick={() => removeQuestion(question.id)}
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                data-testid={`button-remove-question-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Question</Label>
                <RichTextEditor
                  value={question.question}
                  onChange={(value) => updateQuestion(question.id, "question", value)}
                  placeholder="Enter the question..."
                  data-testid={`editor-question-${index}`}
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium text-foreground mb-2 block">Expected Answer</Label>
                <RichTextEditor
                  value={question.expectedAnswer}
                  onChange={(value) => updateQuestion(question.id, "expectedAnswer", value)}
                  placeholder="Enter the expected answer..."
                  data-testid={`editor-answer-${index}`}
                />
              </div>
              
              <div className="flex items-center space-x-4">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1 block">Points</Label>
                  <Input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(question.id, "points", parseInt(e.target.value) || 0)}
                    className="w-20"
                    min="0"
                    data-testid={`input-points-${index}`}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
