import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface hero_card_props {
    title : string;
    content : string;
    icon : LucideIcon;
}

function Hero_cards( {title, content, icon: Icon} : hero_card_props) {
  return (
    <div>
        <Card>
            <CardHeader>
              <Icon className="h-8 w-8 text-primary mb-2" />
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {content}
              </p>
            </CardContent>
          </Card>
    </div>
  )
}

export default Hero_cards