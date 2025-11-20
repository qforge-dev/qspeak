use rodio::{OutputStream, Sink, Source};

pub fn play_start_sound() {
    std::thread::spawn(|| {
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let source = rodio::source::SineWave::new(523.0)
                    .take_duration(std::time::Duration::from_millis(150))
                    .amplify(0.11) // Slightly quieter for higher frequencies
                    .fade_in(std::time::Duration::from_millis(20))
                    .fade_out(std::time::Duration::from_millis(70));

                let source2 = rodio::source::SineWave::new(587.0)
                    .take_duration(std::time::Duration::from_millis(100))
                    .amplify(0.10)
                    .fade_in(std::time::Duration::from_millis(15))
                    .fade_out(std::time::Duration::from_millis(60));

                sink.append(source);
                sink.append(source2);
                sink.sleep_until_end();
            }
        }
    });
}

pub fn play_stop_sound() {
    std::thread::spawn(|| {
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let source = rodio::source::SineWave::new(494.0)
                    .take_duration(std::time::Duration::from_millis(160))
                    .amplify(0.11)
                    .fade_in(std::time::Duration::from_millis(15))
                    .fade_out(std::time::Duration::from_millis(80));

                let source2 = rodio::source::SineWave::new(440.0)
                    .take_duration(std::time::Duration::from_millis(140))
                    .amplify(0.10)
                    .fade_in(std::time::Duration::from_millis(10))
                    .fade_out(std::time::Duration::from_millis(75));

                sink.append(source);
                sink.append(source2);
                sink.sleep_until_end();
            }
        }
    });
}

pub fn play_paste_sound() {
    std::thread::spawn(|| {
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let source =
                    rodio::source::SineWave::new(659.0) // E5 note
                        .take_duration(std::time::Duration::from_millis(120))
                        .amplify(0.10)
                        .fade_in(std::time::Duration::from_millis(15))
                        .fade_out(std::time::Duration::from_millis(50));

                let source2 =
                    rodio::source::SineWave::new(784.0) // G5 note
                        .take_duration(std::time::Duration::from_millis(150))
                        .amplify(0.09)
                        .fade_in(std::time::Duration::from_millis(10))
                        .fade_out(std::time::Duration::from_millis(70));

                sink.append(source);
                sink.append(source2);
                sink.sleep_until_end();
            }
        }
    });
}

pub fn play_cancel_sound() {
    std::thread::spawn(|| {
        if let Ok((_stream, stream_handle)) = OutputStream::try_default() {
            if let Ok(sink) = Sink::try_new(&stream_handle) {
                let source =
                    rodio::source::SineWave::new(466.0) // A#4/Bb4 note
                        .take_duration(std::time::Duration::from_millis(130))
                        .amplify(0.11)
                        .fade_in(std::time::Duration::from_millis(10))
                        .fade_out(std::time::Duration::from_millis(60));

                let source2 =
                    rodio::source::SineWave::new(349.0) // F4 note
                        .take_duration(std::time::Duration::from_millis(180))
                        .amplify(0.12)
                        .fade_in(std::time::Duration::from_millis(15))
                        .fade_out(std::time::Duration::from_millis(90));

                sink.append(source);
                sink.append(source2);
                sink.sleep_until_end();
            }
        }
    });
}
