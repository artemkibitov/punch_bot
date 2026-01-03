BEGIN;

CREATE VIEW v_employee_daily_report AS
SELECT
  e.id AS employee_id,
  e.full_name,
  s.shift_date,
  SUM(
    EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
  ) AS hours_total
FROM shifts s
JOIN employees e ON e.id = s.employee_id
WHERE s.end_time IS NOT NULL
GROUP BY e.id, e.full_name, s.shift_date;

COMMIT;
