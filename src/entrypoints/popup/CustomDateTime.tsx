import { useState, useRef, useEffect } from "react";
import "./CustomDateTime.css";

interface CustomDateTimeProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  label: string;
}

export function CustomDateTime({ value, onChange, min, label }: CustomDateTimeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDate, setTempDate] = useState(value || "");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return { date: "", time: "" };
    const [date, time] = dateTimeStr.split("T");
    return { date, time: time || "00:00" };
  };

  const { date: currentDate, time: currentTime } = parseDateTime(tempDate);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleDateChange = (newDate: string) => {
    const newDateTime = `${newDate}T${currentTime || "00:00"}`;
    setTempDate(newDateTime);
  };

  const handleTimeChange = (newTime: string) => {
    if (currentDate) {
      const newDateTime = `${currentDate}T${newTime}`;
      setTempDate(newDateTime);
    }
  };

  const handleConfirm = () => {
    if (tempDate) {
      onChange(tempDate);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setTempDate("");
    onChange("");
    setIsOpen(false);
  };

  const formatDisplay = (dateTimeStr: string) => {
    if (!dateTimeStr) return label;
    const [date, time] = dateTimeStr.split("T");
    const [year, month, day] = date.split("-");
    return `${year}년 ${month}월 ${day}일 ${time}`;
  };

  const generateCalendar = () => {
    const today = new Date();
    const [year, month] = currentDate 
      ? currentDate.split("-").map(Number)
      : [today.getFullYear(), today.getMonth() + 1];
    
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return { year, month, days };
  };

  const { year, month, days } = generateCalendar();

  const handleDayClick = (day: number) => {
    const newDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    handleDateChange(newDate);
  };

  const handleMonthChange = (delta: number) => {
    const newMonth = month + delta;
    const newYear = year + Math.floor((newMonth - 1) / 12);
    const adjustedMonth = ((newMonth - 1) % 12 + 12) % 12 + 1;
    const newDate = `${newYear}-${String(adjustedMonth).padStart(2, "0")}-01`;
    handleDateChange(newDate);
  };

  const isDateDisabled = (day: number) => {
    if (!min) return false;
    const checkDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return checkDate < min.split("T")[0];
  };

  const selectedDay = currentDate ? parseInt(currentDate.split("-")[2], 10) : null;

  return (
    <div className="custom-datetime-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`custom-datetime-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? "" : "placeholder"}>{formatDisplay(value)}</span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M6 2V4M14 2V4M3 8H17M5 4H15C16.1046 4 17 4.89543 17 6V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V6C3 4.89543 3.89543 4 5 4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="custom-datetime-dropdown">
          <div className="datetime-calendar">
            <div className="calendar-header">
              <button type="button" onClick={() => handleMonthChange(-1)} className="month-nav">
                ‹
              </button>
              <div className="month-label">
                {year}년 {month}월
              </div>
              <button type="button" onClick={() => handleMonthChange(1)} className="month-nav">
                ›
              </button>
            </div>

            <div className="calendar-weekdays">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div key={day} className="weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-days">
              {days.map((day, index) => (
                <button
                  key={index}
                  type="button"
                  className={`calendar-day ${day === selectedDay ? "selected" : ""} ${
                    day && isDateDisabled(day) ? "disabled" : ""
                  }`}
                  onClick={() => day && !isDateDisabled(day) && handleDayClick(day)}
                  disabled={!day || (day && isDateDisabled(day))}
                >
                  {day || ""}
                </button>
              ))}
            </div>
          </div>

          <div className="datetime-time">
            <div className="time-label">시간 선택</div>
            {!showTimePicker ? (
              <button
                type="button"
                className="time-display-button"
                onClick={() => setShowTimePicker(true)}
              >
                {currentTime}
              </button>
            ) : (
              <div className="time-picker">
                <div className="time-picker-row">
                  <button
                    type="button"
                    className="time-adjust-btn"
                    onClick={() => {
                      const [h, m] = currentTime.split(":").map(Number);
                      const newHour = (h + 1) % 24;
                      handleTimeChange(`${String(newHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                    }}
                  >
                    ▲
                  </button>
                  <span className="time-separator"></span>
                  <button
                    type="button"
                    className="time-adjust-btn"
                    onClick={() => {
                      const [h, m] = currentTime.split(":").map(Number);
                      const newMin = (m + 1) % 60;
                      handleTimeChange(`${String(h).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`);
                    }}
                  >
                    ▲
                  </button>
                </div>
                <div className="time-picker-display">
                  <span className="time-digit">{currentTime.split(":")[0]}</span>
                  <span className="time-colon">:</span>
                  <span className="time-digit">{currentTime.split(":")[1]}</span>
                </div>
                <div className="time-picker-row">
                  <button
                    type="button"
                    className="time-adjust-btn"
                    onClick={() => {
                      const [h, m] = currentTime.split(":").map(Number);
                      const newHour = (h - 1 + 24) % 24;
                      handleTimeChange(`${String(newHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                    }}
                  >
                    ▼
                  </button>
                  <span className="time-separator"></span>
                  <button
                    type="button"
                    className="time-adjust-btn"
                    onClick={() => {
                      const [h, m] = currentTime.split(":").map(Number);
                      const newMin = (m - 1 + 60) % 60;
                      handleTimeChange(`${String(h).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`);
                    }}
                  >
                    ▼
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="datetime-actions">
            <button type="button" onClick={handleClear} className="btn-clear">
              초기화
            </button>
            <button type="button" onClick={handleConfirm} className="btn-confirm" disabled={!tempDate}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
