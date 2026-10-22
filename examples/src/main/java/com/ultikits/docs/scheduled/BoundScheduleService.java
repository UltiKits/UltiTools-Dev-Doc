package com.ultikits.docs.scheduled;

import com.ultikits.ultitools.annotations.Scheduled;
import com.ultikits.ultitools.annotations.Service;

@Service
public class BoundScheduleService {

    @Scheduled(config = BoundScheduleConfig.class, periodKey = "interest.interval", delayKey = "interest.interval")
    public void distributeInterest() {
        // 首次等待一个完整间隔，此后每隔 interest.interval 秒在主线程执行。
    }
}
