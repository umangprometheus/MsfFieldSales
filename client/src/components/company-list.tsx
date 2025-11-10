import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, MapPin } from "lucide-react";
import type { CompanyWithDistance } from "@shared/schema";

interface CompanyListProps {
  companies: CompanyWithDistance[];
  selectedIds: string[];
  onToggle: (companyId: string) => void;
  onCompanyClick?: (companyId: string) => void;
  className?: string;
}

export default function CompanyList({
  companies,
  selectedIds,
  onToggle,
  onCompanyClick,
  className = "",
}: CompanyListProps) {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No companies found</p>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your radius or location</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {companies.map((company) => {
        const isSelected = selectedIds.includes(company.id);
        
        return (
          <Card
            key={company.id}
            className={`p-4 hover-elevate transition-all cursor-pointer ${
              isSelected ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onCompanyClick?.(company.id)}
            data-testid={`card-company-${company.id}`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(company.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
                data-testid={`checkbox-company-${company.id}`}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-base font-semibold text-foreground truncate">
                    {company.name}
                  </h3>
                  <Badge 
                    variant="secondary" 
                    className="bg-success/10 text-success hover:bg-success/20 flex-shrink-0"
                    data-testid={`badge-distance-${company.id}`}
                  >
                    {company.distanceMi.toFixed(1)} mi
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <p className="truncate">
                    {[company.street, company.city, company.state, company.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
