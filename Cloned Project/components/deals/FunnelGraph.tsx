"use client";
import React, { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { authenticatedFetch } from "@/utils/api";
import { buildExternalUrl } from "@/lib/api-config";

ChartJS.register(ArcElement, Tooltip, Legend);

type FilterKey = "week" | "month" | "year";

interface LeadCountData {
  count?: number;
  total?: number;
  stageCounts?: Record<string, number>;
  leadsWon?: number;
  totalNegotiatedPricing?: number;
  [key: string]: any;
}



const options = {
  cutout: "77%",
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
      labels: {
        usePointStyle: true,
        boxWidth: 12,
        padding: 24,
      },
    },
  },
};

export default function FunnelGraph() {
  const [leadsCountData, setLeadsCountData] = useState<LeadCountData>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeadsCount = async () => {
      try {
        const response = await authenticatedFetch(buildExternalUrl('crm/leads/count'));
        const data = await response.json();
        console.log("FunnelGraph API Response:", data);
        setLeadsCountData(data);
      } catch (error) {
        console.error("Error fetching leads count:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeadsCount();
  }, []);

  // Calculate funnel data based on leads count data
  const getFunnelData = (filterKey: FilterKey) => {
    // Check if we have stage-wise data from the count API
    if (leadsCountData.stageCounts && Object.keys(leadsCountData.stageCounts).length > 0) {
      const stageCounts = leadsCountData.stageCounts;
      const labels = Object.keys(stageCounts);
      const data = Object.values(stageCounts);
      const backgroundColor = [
        "#7DA7F3", "#A4D198", "#FFB366", "#FF6B6B", "#4ECDC4", 
        "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8"
      ].slice(0, labels.length);

      return {
        labels,
        datasets: [{
          data,
          backgroundColor,
          borderWidth: 0,
        }],
      };
    }

    // Fallback: If no stage data available, show total count as a single segment
    const totalCount = leadsCountData.count || leadsCountData.total || 0;
    if (totalCount > 0) {
      return {
        labels: ['Total Leads'],
        datasets: [{
          data: [totalCount],
          backgroundColor: ["#7DA7F3"],
          borderWidth: 0,
        }],
      };
    }

    // No data available
    return { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] };
  };

  const funnelData = getFunnelData("month");

  return (
    <div
      className="bg-white rounded-xl p-8 " // Converted inline styles to Tailwind classes
      style={{
        maxWidth: 370,
      }}
    >
      <div className="flex justify-between items-center mb-4">
        {" "}
        {/* Added flex container */}
        <h2 className="text-lg font-medium">Funnel</h2>{" "}
        {/* Adjusted font size and weight */}
      </div>
      {/* Removed the date range div as it's not in the image */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (leadsCountData.count || leadsCountData.total || leadsCountData.stages) ? (
        <Doughnut data={funnelData} options={options} />
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
}
