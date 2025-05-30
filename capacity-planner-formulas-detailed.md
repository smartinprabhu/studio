
# Capacity Planner: Formulas, Concepts, and Examples (Detailed)

This document outlines the key metrics, formulas, concepts, and example calculations used in the Capacity Planner dashboard at the Business Unit (BU), Line of Business (LOB), and Team levels, with detailed breakdowns of dependent calculations.

## I. General Concepts

### Standard Work Minutes
The planner uses standard work minutes for Headcount (HC) calculations:
-   **Standard Weekly Work Minutes**: `40 hours/week * 60 minutes/hour = 2400 minutes`
-   **Standard Monthly Work Minutes**: `(40 hours/week * 52 weeks/year / 12 months/year) * 60 minutes/hour = 10400 minutes`
    *(Note: The monthly value is an average. For precise monthly calculations based on actual workdays, a more complex calendar-aware logic would be needed. This planner uses the average.)*

The specific value (`standardWorkMinutesForPeriod`) is chosen based on whether the view is "Week" or "Month".

---

## II. Team Level Calculations

Team-level metrics form the most detailed part of the capacity plan.

### A. Team Inputs (Editable Assumptions per Period)

These are the primary levers planners can adjust for each team, for each time period (week/month).

1.  **AHT (Average Handle Time)**
    *   **Concept**: The average time, in minutes, an agent spends on a single interaction (e.g., call, chat, email), including any associated wrap-up time.
    *   **Unit**: Minutes
    *   **Example Value**: `15 minutes`

2.  **Shrinkage %**
    *   **Concept**: The percentage of paid time during which agents are not available to handle interactions. This includes scheduled activities like breaks, meetings, training, and unscheduled ones like system downtime or personal time off.
    *   **Unit**: Percentage (%)
    *   **Example Value**: `10%` (meaning agents are available for productive work 90% of their paid time).

3.  **Occupancy %**
    *   **Concept**: The percentage of time agents are actively engaged in handling interactions (talk time, hold time, wrap-up time) compared to their total *available, logged-in time* scheduled for handling interactions. It's a measure of how busy agents are *while they are available and expected to be working on customer interactions*.
    *   **Unit**: Percentage (%)
    *   **Example Value**: `85%` (meaning agents spend 85% of their available time on interactions, with 15% for other tasks or idle time).

4.  **Backlog %**
    *   **Concept**: The percentage of additional workload (e.g., deferred tasks, unresolved issues from previous periods) that needs to be handled on top of the forecasted volume for the current period.
    *   **Unit**: Percentage (%)
    *   **Example Value**: `5%` (meaning an additional 5% of the forecasted workload needs to be processed).

5.  **Attrition %**
    *   **Concept**: The percentage of agents expected to leave the team (voluntarily or involuntarily) during the period, based on the starting headcount of that period.
    *   **Unit**: Percentage (%)
    *   **Example Value**: `2%`

6.  **Volume Mix %**
    *   **Concept**: The percentage of the parent LOB's total forecasted volume (or required minutes) that this specific team is responsible for handling. The sum of `Volume Mix %` for all teams under an LOB should be 100%.
    *   **Unit**: Percentage (%)
    *   **Example Value**: `40%` (meaning this team handles 40% of the LOB's workload).

7.  **Actual/Starting HC**
    *   **Concept**: The actual number of headcount (agents) available or planned to be available at the *beginning* of the period. This is a key input for determining existing capacity.
    *   **Unit**: Headcount (can be fractional, representing part-time staff or FTE equivalents)
    *   **Example Value**: `50 HC`

8.  **Move In (+)**
    *   **Concept**: Number of agents transferring into this team from another team/department during the period. These agents are typically assumed to be productive immediately.
    *   **Unit**: Headcount
    *   **Example Value**: `2 HC`

9.  **Move Out (-)**
    *   **Concept**: Number of agents transferring out of this team to another team/department during the period.
    *   **Unit**: Headcount
    *   **Example Value**: `1 HC`

10. **New Hire Batch**
    *   **Concept**: Number of new agents starting in a training batch associated with this team during the period. These agents are not yet productive and do not contribute to `New Hire Production` in the *same* period they start training (unless training is very short).
    *   **Unit**: Headcount
    *   **Example Value**: `5 HC`

11. **New Hire Production**
    *   **Concept**: Number of new agents completing training and becoming productive within this team during the period. These agents contribute to the ending headcount.
    *   **Unit**: Headcount
    *   **Example Value**: `3 HC`

### B. Team Calculated Metrics (Derived per Period)

1.  **Team Effective Required Agent Minutes (`_calculatedRequiredAgentMinutes`)**
    *   **Concept**: The total agent minutes this team needs to deliver, accounting for both its share of the LOB's forecast (distributed via Volume Mix %) and its own specific backlog.
    *   **Formula**:
        `Team Effective Required Agent Minutes = (LOB Total Base Required Minutes for Period * (Team Volume Mix % / 100)) * (1 + (Team Backlog % / 100))`
        *   Where:
            *   `LOB Total Base Required Minutes for Period`: Calculated or input at the LOB level (see Section III.A.3).
            *   `Team Volume Mix %`: Input for the team.
            *   `Team Backlog %`: Input for the team.
    *   **Example Calculation**:
        *   Given:
            *   LOB Total Base Required Minutes for Period = `100,000 minutes`
            *   Team Volume Mix % = `40%`
            *   Team Backlog % = `5%`
        *   Calculation:
            *   Team's share of LOB minutes = `100,000 minutes * (40 / 100) = 40,000 minutes`
            *   Backlog adjustment factor = `(1 + 5 / 100) = 1.05`
            *   Team Effective Required Agent Minutes = `40,000 minutes * 1.05 = 42,000 minutes`
        *   Result: `42,000 minutes`

2.  **Team Required HC**
    *   **Concept**: The number of agents theoretically needed to handle the `Team Effective Required Agent Minutes`, considering their work schedule, shrinkage, and target occupancy.
    *   **Formula**:
        *   `Team Required HC = Team Effective Required Agent Minutes / Effective Productive Minutes per HC for the Period`
        *   Where:
            *   `Team Effective Required Agent Minutes` is calculated as shown above (Section II.B.1).
            *   `Effective Productive Minutes per HC for the Period = Standard Work Minutes for Period * (1 - Team Shrinkage % / 100) * (Team Occupancy % / 100)`
                *   `Standard Work Minutes for Period` is from Section I.
                *   `Team Shrinkage %` and `Team Occupancy %` are inputs for the team.
    *   **Example Calculation (for a Weekly period)**:
        *   Given:
            *   Team Effective Required Agent Minutes = `42,000 minutes` (from Section II.B.1)
            *   Standard Weekly Work Minutes = `2400 minutes`
            *   Team Shrinkage % = `10%`
            *   Team Occupancy % = `85%`
        *   Step 1: Calculate `Effective Productive Minutes per HC for the Period`:
            *   `2400 * (1 - 10/100) * (85/100) = 2400 * 0.90 * 0.85 = 2400 * 0.765 = 1836 minutes/HC`
        *   Step 2: Calculate `Team Required HC`:
            *   `42,000 minutes / 1836 minutes/HC = 22.8758 HC`
        *   Result: `22.88 HC` (typically rounded to 2 decimal places)
        *   *(Note: If `Team Effective Required Agent Minutes` is 0, `Required HC` is 0. If `Effective Productive Minutes per HC` is 0 due to 100% shrinkage or 0% occupancy, and workload is >0, Required HC is effectively infinite or shown as null/error.)*

3.  **Team Over/Under HC**
    *   **Concept**: The difference between the team's actual/starting headcount and the calculated required headcount. Positive indicates a surplus; negative indicates a deficit.
    *   **Formula**: `Team Actual/Starting HC - Team Required HC`
        *   Where:
            *   `Team Actual/Starting HC` is an input.
            *   `Team Required HC` is calculated as shown above (Section II.B.2).
    *   **Example Calculation**:
        *   Given:
            *   Team Actual/Starting HC = `20 HC`
            *   Team Required HC = `22.88 HC` (calculated above)
        *   Calculation: `20 HC - 22.88 HC = -2.88 HC`
        *   Result: `-2.88 HC` (Deficit)

4.  **Team Attrition Loss HC**
    *   **Concept**: The number of agents (HC) lost to attrition during the period, based on the team's starting headcount and attrition rate.
    *   **Formula**: `Team Actual/Starting HC * (Team Attrition % / 100)`
        *   Where:
            *   `Team Actual/Starting HC` is an input.
            *   `Team Attrition %` is an input.
    *   **Example Calculation**:
        *   Given:
            *   Team Actual/Starting HC = `20 HC`
            *   Team Attrition % = `2%`
        *   Calculation: `20 HC * (2 / 100) = 20 * 0.02 = 0.4 HC`
        *   Result: `0.4 HC`

5.  **Team HC After Attrition**
    *   **Concept**: Headcount remaining after attrition losses are accounted for, but before other HC adjustments like new hires or transfers.
    *   **Formula**: `Team Actual/Starting HC - Team Attrition Loss HC`
        *   Where:
            *   `Team Actual/Starting HC` is an input.
            *   `Team Attrition Loss HC` is calculated as shown above (Section II.B.4).
    *   **Example Calculation**:
        *   Given:
            *   Team Actual/Starting HC = `20 HC`
            *   Team Attrition Loss HC = `0.4 HC` (calculated above)
        *   Calculation: `20 HC - 0.4 HC = 19.6 HC`
        *   Result: `19.6 HC`

6.  **Team Ending HC**
    *   **Concept**: The projected headcount at the end of the period, after all adjustments (attrition, new hires becoming productive, transfers in/out). This value typically becomes the starting HC for the subsequent period in a continuous planning model.
    *   **Formula**: `Team HC After Attrition + Team New Hire Production + Team Move In - Team Move Out`
        *   Where:
            *   `Team HC After Attrition` is calculated as shown above (Section II.B.5).
            *   `Team New Hire Production`, `Team Move In`, `Team Move Out` are inputs.
    *   **Example Calculation**:
        *   Given:
            *   Team HC After Attrition = `19.6 HC` (calculated above)
            *   Team New Hire Production = `3 HC`
            *   Team Move In = `2 HC`
            *   Team Move Out = `1 HC`
        *   Calculation: `19.6 + 3 + 2 - 1 = 23.6 HC`
        *   Result: `23.6 HC`

7.  **Team Actual Productive Agent Minutes (`_calculatedActualProductiveAgentMinutes`)**
    *   **Concept**: The total productive minutes the team's actual/starting headcount *can deliver* in the period, considering their schedule, shrinkage, and target occupancy. This shows the team's capacity in minutes.
    *   **Formula**: `Team Actual/Starting HC * Standard Work Minutes for Period * (1 - Team Shrinkage % / 100) * (Team Occupancy % / 100)`
        *   Where:
            *   `Team Actual/Starting HC`, `Team Shrinkage %`, `Team Occupancy %` are inputs.
            *   `Standard Work Minutes for Period` is a general concept value (Section I).
    *   **Example Calculation (for a Weekly period)**:
        *   Given:
            *   Team Actual/Starting HC = `20 HC`
            *   Standard Weekly Work Minutes = `2400 minutes`
            *   Team Shrinkage % = `10%`
            *   Team Occupancy % = `85%`
        *   Calculation: `20 * 2400 * (1 - 10/100) * (85/100) = 20 * 2400 * 0.90 * 0.85 = 20 * 1836 = 36,720 minutes`
        *   Result: `36,720 minutes`

---

## III. Line of Business (LOB) Level Calculations

LOB metrics are either direct inputs related to the LOB's overall forecast or aggregations of its constituent teams' metrics.

### A. LOB Inputs (Editable Assumptions per Period)

1.  **LOB Volume Forecast**
    *   **Concept**: The total number of interactions (e.g., calls, chats, emails) forecasted for this LOB for the period, before being broken down by team.
    *   **Unit**: Interactions/Contacts
    *   **Example Value**: `25000 contacts`

2.  **LOB Average AHT**
    *   **Concept**: The average handle time, in minutes, assumed for interactions within this LOB. This is used with the LOB Volume Forecast to derive the LOB's total workload in minutes if a more detailed AHT breakdown per team or interaction type isn't used at this stage.
    *   **Unit**: Minutes
    *   **Example Value**: `10 minutes`

3.  **LOB Total Base Required Minutes**
    *   **Concept**: The total agent minutes required to handle the LOB's forecasted volume, before this workload is distributed to teams or adjusted for team-specific backlogs. This is a crucial input for team-level calculations.
    *   **Primary Calculation Method**:
        *   **Formula**: `LOB Volume Forecast * LOB Average AHT`
        *   **Example Calculation**:
            *   Given:
                *   LOB Volume Forecast = `25000 contacts`
                *   LOB Average AHT = `10 minutes`
            *   Calculation: `25000 * 10 = 250,000 minutes`
            *   Result: `250,000 minutes`
    *   **Direct Input**: The system allows this field to be a direct input (editable at the LOB level in the table) if `LOB Volume Forecast` or `LOB Average AHT` are not provided or are zero for a period. In such cases, the directly entered value is used.
    *   **Unit**: Minutes

### B. LOB Calculated/Aggregated Metrics (Derived per Period)

These are sums of the corresponding metrics from all *selected/active* teams under this LOB.

1.  **LOB Required HC**
    *   **Concept**: The total required headcount for the LOB, summed from its teams.
    *   **Formula**: `SUM (Team Required HC for all teams in this LOB)`
        *   Each `Team Required HC` is calculated as detailed in Section II.B.2.
    *   **Example Calculation**:
        *   Given:
            *   Team Alpha Required HC = `22.88 HC`
            *   Team Bravo Required HC = `30.50 HC`
            *   Team Charlie Required HC = `15.00 HC`
        *   Calculation: `22.88 + 30.50 + 15.00 = 68.38 HC`
        *   Result: `68.38 HC`
    *   **Tooltip**: "Sum of Required HC from Team Alpha (22.88), Team Bravo (30.50), Team Charlie (15.00)"

2.  **LOB Actual/Starting HC**
    *   **Concept**: The total actual/starting headcount for the LOB, summed from its teams.
    *   **Formula**: `SUM (Team Actual/Starting HC for all teams in this LOB)`
        *   Each `Team Actual/Starting HC` is an input at the team level.
    *   **Example Calculation**:
        *   Given:
            *   Team Alpha Actual/Starting HC = `20 HC`
            *   Team Bravo Actual/Starting HC = `32 HC`
            *   Team Charlie Actual/Starting HC = `14 HC`
        *   Calculation: `20 + 32 + 14 = 66 HC`
        *   Result: `66 HC`
    *   **Tooltip**: "Sum of Actual/Starting HC from Team Alpha (20), Team Bravo (32), Team Charlie (14)"

3.  **LOB Over/Under HC**
    *   **Concept**: The overall headcount surplus or deficit for the LOB.
    *   **Formula**: `LOB Actual/Starting HC - LOB Required HC`
        *   Where `LOB Actual/Starting HC` and `LOB Required HC` are aggregated as shown above.
    *   **Example Calculation**:
        *   Given:
            *   LOB Actual/Starting HC = `66 HC` (aggregated)
            *   LOB Required HC = `68.38 HC` (aggregated)
        *   Calculation: `66 - 68.38 = -2.38 HC`
        *   Result: `-2.38 HC` (Deficit)

---

## IV. Business Unit (BU) Level Calculations

BU metrics are aggregations of the metrics from all *selected/active* LOBs under this BU.

### A. BU Calculated/Aggregated Metrics (Derived per Period)

1.  **BU Required HC**
    *   **Concept**: The total required headcount for the Business Unit.
    *   **Formula**: `SUM (LOB Required HC for all LOBs in this BU)`
        *   Each `LOB Required HC` is aggregated from its teams as detailed in Section III.B.1.
    *   **Example Calculation**:
        *   Given:
            *   LOB Customer Service Required HC = `68.38 HC`
            *   LOB Sales Required HC = `102.10 HC`
        *   Calculation: `68.38 + 102.10 = 170.48 HC`
        *   Result: `170.48 HC`
    *   **Tooltip**: "Sum of Required HC from LOB Customer Service (68.38), LOB Sales (102.10)"

2.  **BU Actual/Starting HC**
    *   **Concept**: The total actual/starting headcount for the Business Unit.
    *   **Formula**: `SUM (LOB Actual/Starting HC for all LOBs in this BU)`
        *   Each `LOB Actual/Starting HC` is aggregated from its teams as detailed in Section III.B.2.
    *   **Example Calculation**:
        *   Given:
            *   LOB Customer Service Actual/Starting HC = `66 HC`
            *   LOB Sales Actual/Starting HC = `100 HC`
        *   Calculation: `66 + 100 = 166 HC`
        *   Result: `166 HC`
    *   **Tooltip**: "Sum of Actual/Starting HC from LOB Customer Service (66), LOB Sales (100)"

3.  **BU Over/Under HC**
    *   **Concept**: The overall headcount surplus or deficit for the Business Unit.
    *   **Formula**: `BU Actual/Starting HC - BU Required HC`
        *   Where `BU Actual/Starting HC` and `BU Required HC` are aggregated as shown above.
    *   **Example Calculation**:
        *   Given:
            *   BU Actual/Starting HC = `166 HC` (aggregated)
            *   BU Required HC = `170.48 HC` (aggregated)
        *   Calculation: `166 - 170.48 = -4.48 HC`
        *   Result: `-4.48 HC` (Deficit)

---
