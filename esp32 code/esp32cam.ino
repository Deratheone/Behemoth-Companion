#include "esp_camera.h"
#include "FS.h"
#include "SD_MMC.h"

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define UART_TX  17
#define UART_RX  16
#define TRIGGER_PIN  13  // Example GPIO for sensor trigger

void setup() {
  Serial.begin(115200);
  pinMode(TRIGGER_PIN, INPUT);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  // QVGA (320x240) keeps JPEG size small (~3-6KB) which is critical:
  // The image travels over UART to the main ESP32, gets base64-encoded
  // (+33%), then published via MQTT. Smaller = faster transfer, lower
  // heap usage, and well within HiveMQ's 256MB message size limit.
  config.frame_size   = FRAMESIZE_QVGA;   // 320x240 (was VGA 640x480)
  config.jpeg_quality = 12;               // 10=highest quality, 63=lowest

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    while (1);
  }

  if (!SD_MMC.begin()) {
    Serial.println("SD Card Mount Failed");
    while (1);
  }

  Serial1.begin(115200, SERIAL_8N1, UART_RX, UART_TX);
}

void loop() {
  // Wait for a trigger (e.g., from main ESP32 or sensor)
  if (digitalRead(TRIGGER_PIN) == HIGH) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      return;
    }
    // Save to SD
    File file = SD_MMC.open("/snapshot.jpg", FILE_WRITE);
    if (file) {
      file.write(fb->buf, fb->len);
      file.close();
      Serial.println("Image saved to SD");
    }
    esp_camera_fb_return(fb);
    delay(500); // Debounce
  }

  // Wait for main ESP32 to request image
  if (Serial1.available()) {
    String cmd = Serial1.readStringUntil('\n');
    if (cmd == "GET_IMAGE") {
      File img = SD_MMC.open("/snapshot.jpg");
      if (img) {
        Serial1.println(img.size());
        uint8_t buf[512];
        while (img.available()) {
          size_t len = img.read(buf, sizeof(buf));
          Serial1.write(buf, len);
        }
        img.close();
      }
    }
  }
}
