import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ endTime, onTimeElapsed, itemId }) => {
  const calculateRemainingTime = () => {
    const now = new Date().getTime();
    const distance = endTime - now;

    return {
      days: Math.floor(distance / (1000 * 60 * 60 * 24)),
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((distance % (1000 * 60)) / 1000),
    };
  };

  const [remainingTime, setRemainingTime] = useState(calculateRemainingTime());

  useEffect(() => {
    const timer = setInterval(() => {
      const newRemainingTime = calculateRemainingTime();
      setRemainingTime(newRemainingTime);

      if (
        newRemainingTime.days <= 0 &&
        newRemainingTime.hours <= 0 &&
        newRemainingTime.minutes <= 0 &&
        newRemainingTime.seconds <= 0
      ) {
        onTimeElapsed(itemId);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, itemId, onTimeElapsed]);

  return (
    <div className="countdown-timer">
      {remainingTime.days > 0 && <span>{remainingTime.days}d </span>}
      {remainingTime.hours > 0 && <span>{remainingTime.hours}h </span>}
      {remainingTime.minutes > 0 && <span>{remainingTime.minutes}m </span>}
      {remainingTime.seconds}s
    </div>
  );
};

export default CountdownTimer; 