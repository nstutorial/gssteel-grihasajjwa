import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_invested: number;
}

export function PartnersList({ partners }: { partners: Partner[] }) {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {partners.map((partner) => (
        <Card 
          key={partner.id} 
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => navigate(`/partners/${partner.id}`)}
        >
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
                 <span>{partner.name}</span>
              {/* ✅ Multiply first, then apply logic */}
              <span
                className={`text-sm font-semibold ${
                  (partner.total_invested * -1) >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{(partner.total_invested * -1).toFixed(2)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partner.phone && (
              <p className="text-sm">
                <span className="font-medium">Phone:</span> {partner.phone}
              </p>
            )}
            {partner.email && (
              <p className="text-sm">
                <span className="font-medium">Email:</span> {partner.email}
              </p>
            )}
            {partner.address && (
              <p className="text-sm">
                <span className="font-medium">Address:</span> {partner.address}
              </p>
            )}
            <div className="mt-3">
              <Button size="sm" onClick={(e) => {
                e.stopPropagation();
                navigate(`/partners/${partner.id}`);
              }}>
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
