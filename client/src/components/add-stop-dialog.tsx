import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Plus, MapPin } from "lucide-react";
import { useCompanies } from "@/lib/api";

interface AddStopDialogProps {
  open: boolean;
  onClose: () => void;
  onAddStop: (company: { id: string; name: string; street: string | null; city: string | null; state: string | null }) => void;
  currentLocation?: { lat: number; lng: number } | null;
  excludeCompanyIds: string[];
}

export default function AddStopDialog({
  open,
  onClose,
  onAddStop,
  currentLocation,
  excludeCompanyIds,
}: AddStopDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const { data: companiesData, isLoading } = useCompanies({
    search: searchTerm,
    lat: currentLocation?.lat,
    lng: currentLocation?.lng,
    radiusMi: 50, // Show companies within 50 miles
    enabled: open, // Only fetch when dialog is open
  });

  const companies = companiesData?.companies || [];
  
  // Filter out companies already in the route
  const availableCompanies = companies.filter(
    (c) => !excludeCompanyIds.includes(c.id)
  );

  const handleAddCompany = (company: typeof companies[0]) => {
    onAddStop(company);
    setSearchTerm("");
    onClose();
  };

  const searchContent = (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-add-stop"
            />
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading companies...
              </p>
            )}

            {!isLoading && availableCompanies.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm
                  ? "No companies found. Try a different search."
                  : "Type to search for companies to add..."}
              </p>
            )}

            {!isLoading &&
              availableCompanies.map((company) => (
                <Card
                  key={company.id}
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => handleAddCompany(company)}
                  data-testid={`card-add-company-${company.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1">
                        {company.name}
                      </h3>
                      {(company.street || company.city) && (
                        <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <p className="break-words">
                            {[company.street, company.city, company.state]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                      {company.distanceMi !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {company.distanceMi.toFixed(1)} mi away
                        </p>
                      )}
                    </div>
                    <Button
                      className="h-11 w-11 md:h-9 md:w-9"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddCompany(company);
                      }}
                      data-testid={`button-add-company-${company.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>

      <div className="flex justify-end gap-2 pt-2 border-t md:border-t-0 md:pt-0">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-add-stop">
          Cancel
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>Add Stop to Route</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 flex-1 overflow-hidden flex flex-col min-h-0">
            {searchContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Add Stop to Route</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {searchContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
