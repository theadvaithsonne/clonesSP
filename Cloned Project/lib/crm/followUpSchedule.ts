export type FollowUpScheduleResult = {
  dueDates: Date[];
  intervalDays: number;
  usingDefaultPattern: boolean;
  error?: string;
};

export function buildFollowUpSchedule(
  scheduledDate: string,
  followUpIntervalDays: string,
  autoFollowUpEndDate: string
): FollowUpScheduleResult {
  if (!scheduledDate) {
    return {
      dueDates: [],
      intervalDays: 2,
      usingDefaultPattern: true,
      error: "Please select a valid start date",
    };
  }

  const intervalInput = parseInt(followUpIntervalDays, 10);
  const intervalDays = Number.isFinite(intervalInput) && intervalInput > 0 ? intervalInput : 2;
  const usingDefaultPattern = !followUpIntervalDays?.trim() && !autoFollowUpEndDate;

  const startDate = new Date(`${scheduledDate}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    return {
      dueDates: [],
      intervalDays,
      usingDefaultPattern,
      error: "Please select a valid start date",
    };
  }

  let endDate: Date | null = null;
  if (autoFollowUpEndDate) {
    const parsedEndDate = new Date(`${autoFollowUpEndDate}T00:00:00`);
    if (Number.isNaN(parsedEndDate.getTime())) {
      return {
        dueDates: [],
        intervalDays,
        usingDefaultPattern,
        error: "Please select a valid end date",
      };
    }
    endDate = parsedEndDate;
  }

  if (endDate && endDate < startDate) {
    return {
      dueDates: [],
      intervalDays,
      usingDefaultPattern,
      error: "End date cannot be before follow-up date",
    };
  }

  const dueDates: Date[] = [];
  const cursorDate = new Date(startDate);
  if (endDate) {
    while (cursorDate <= endDate) {
      dueDates.push(new Date(cursorDate));
      cursorDate.setDate(cursorDate.getDate() + intervalDays);
    }
  } else {
    for (let i = 0; i < 3; i += 1) {
      dueDates.push(new Date(cursorDate));
      cursorDate.setDate(cursorDate.getDate() + intervalDays);
    }
  }

  return {
    dueDates,
    intervalDays,
    usingDefaultPattern,
  };
}
