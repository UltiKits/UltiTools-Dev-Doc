package com.ultikits.docs.scheduled;

import com.ultikits.ultitools.annotations.Scheduled;
import com.ultikits.ultitools.annotations.Service;

@Service
public class BoundScheduleService {

    @Scheduled(config = BoundScheduleConfig.class, periodKey = "interest.interval", delayKey = "interest.interval")
    public void distributeInterest() {
        // Wait one full interval, then run on the main thread every interest.interval seconds.
    }
}
