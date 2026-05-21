import React from "react";
import { Outlet } from "react-router-dom";
import { StudentsSubnav } from "../components/StudentsSubnav";

export const StudentsLayout: React.FC = () => (
  <div className="space-y-0 animate-fade-in">
    <StudentsSubnav />
    <Outlet />
  </div>
);
