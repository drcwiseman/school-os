import React from "react";
import { useParams } from "react-router-dom";
import { MessagingHub } from "../components/messaging/MessagingHub";

export const Messaging: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  if (!schoolSlug) return null;
  return <MessagingHub schoolSlug={schoolSlug} />;
};
