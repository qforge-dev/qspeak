#[allow(unused_imports)]
use fast_image_resize::{
    CpuExtensions, PixelType, ResizeAlg, ResizeOptions, Resizer, images::Image,
};
use screenshots::Screen;

pub fn resize_image(src_image: Image) -> Image {
    let mut dst_image = Image::new(1280, 720, PixelType::U8x4);

    let mut resizer = Resizer::new();

    #[cfg(target_arch = "x86_64")]
    unsafe {
        resizer.set_cpu_extensions(CpuExtensions::Avx2);
    }

    let mut resize_options = ResizeOptions::new();
    // other options - https://docs.rs/fast_image_resize/latest/fast_image_resize/enum.ResizeAlg.html
    resize_options.algorithm = ResizeAlg::Nearest;

    resizer
        .resize(&src_image, &mut dst_image, Some(&resize_options))
        .expect("Failed to resize image");

    dst_image
}

pub fn make_screenshot() -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    match Screen::all() {
        Ok(screens) => {
            if let Some(screen) = screens.first() {
                match screen.capture() {
                    Ok(image) => {
                        let src_image = Image::from_vec_u8(
                            image.width(),
                            image.height(),
                            image.as_raw().to_vec(),
                            PixelType::U8x4,
                        )
                        .expect("Failed to create source image");

                        let dst_image = resize_image(src_image);

                        let mut png_data = Vec::new();
                        let encoder =
                            screenshots::image::codecs::png::PngEncoder::new(&mut png_data);
                        #[allow(deprecated)]
                        let _ = encoder.encode(
                            dst_image.buffer(),
                            dst_image.width(),
                            dst_image.height(),
                            screenshots::image::ColorType::Rgba8,
                        );

                        return Ok(png_data);
                    }
                    Err(e) => {
                        return Err(e.into());
                    }
                }
            } else {
                return Err("No screens found for screenshot".into());
            }
        }
        Err(e) => {
            return Err(e.into());
        }
    }
}
