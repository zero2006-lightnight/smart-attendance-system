import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict


class FaceRecognition:
    """Face recognition using OpenCV - compatible API"""

    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_eye.xml"
        )

    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        elif image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)

        result = []
        for x, y, w, h in faces:
            result.append((y, x + w, y + h, x))
        return result

    def face_locations(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        return self.detect_faces(image)

    def face_encodings(
        self, image: np.ndarray, face_locations: List[Tuple[int, int, int, int]] = None
    ) -> List[np.ndarray]:
        if face_locations is None:
            face_locations = self.detect_faces(image)

        encodings = []
        for loc in face_locations:
            top, right, bottom, left = loc
            face_img = image[top:bottom, left:right]

            if face_img.size == 0:
                continue

            face_img = cv2.resize(face_img, (128, 128))
            embedding = face_img.flatten().astype(np.float32)

            mean = np.mean(embedding)
            std = np.std(embedding)
            if std > 0:
                embedding = (embedding - mean) / std

            embedding = embedding[:128]
            encodings.append(embedding)

        return encodings

    def face_landmarks(
        self, image: np.ndarray, face_locations: List[Tuple[int, int, int, int]] = None
    ) -> List[Dict]:
        if face_locations is None:
            face_locations = self.detect_faces(image)

        landmarks_list = []

        for loc in face_locations:
            top, right, bottom, left = loc
            face_gray = cv2.cvtColor(image[top:bottom, left:right], cv2.COLOR_BGR2GRAY)

            eyes = self.eye_cascade.detectMultiScale(face_gray, 1.1, 5)

            landmarks = {"left_eye": [], "right_eye": [], "nose": [], "mouth": []}

            eyes = sorted(eyes, key=lambda e: e[0])

            if len(eyes) >= 2:
                ex1, ey1, ew1, eh1 = eyes[0]
                ex2, ey2, ew2, eh2 = eyes[1]

                left_eye_center = (left + ex1 + ew1 // 2, top + ey1 + eh1 // 2)
                right_eye_center = (left + ex2 + ew2 // 2, top + ey2 + eh2 // 2)

                for dx in range(-3, 4):
                    for dy in range(-2, 3):
                        landmarks["left_eye"].append(
                            {"x": left_eye_center[0] + dx, "y": left_eye_center[1] + dy}
                        )
                        landmarks["right_eye"].append(
                            {
                                "x": right_eye_center[0] + dx,
                                "y": right_eye_center[1] + dy,
                            }
                        )

            elif len(eyes) == 1:
                ex, ey, ew, eh = eyes[0]
                eye_center = (left + ex + ew // 2, top + ey + eh // 2)

                for dx in range(-3, 4):
                    for dy in range(-2, 3):
                        landmarks["left_eye"].append(
                            {"x": eye_center[0] - 20 + dx, "y": eye_center[1] + dy}
                        )
                        landmarks["right_eye"].append(
                            {"x": eye_center[0] + 20 + dx, "y": eye_center[1] + dy}
                        )

            nose_center = (left + (right - left) // 2, top + (bottom - top) * 2 // 3)
            for dx in range(-2, 3):
                landmarks["nose"].append(
                    {"x": nose_center[0] + dx, "y": nose_center[1]}
                )

            mouth_center = (left + (right - left) // 2, top + (bottom - top) * 4 // 5)
            for dx in range(-4, 5):
                for dy in range(-1, 2):
                    landmarks["mouth"].append(
                        {"x": mouth_center[0] + dx, "y": mouth_center[1] + dy}
                    )

            landmarks_list.append(landmarks)

        return landmarks_list

    def face_distance(
        self, face_encodings: List[np.ndarray], encoding_to_compare: np.ndarray
    ) -> np.ndarray:
        if not face_encodings:
            return np.array([])

        distances = []
        for encoding in face_encodings:
            if encoding is not None and encoding_to_compare is not None:
                dist = np.linalg.norm(encoding - encoding_to_compare)
                distances.append(dist)
            else:
                distances.append(1.0)

        return np.array(distances)

    def compare_faces(
        self,
        known_encoding: np.ndarray,
        encoding_to_compare: np.ndarray,
        tolerance: float = 0.6,
    ) -> bool:
        if known_encoding is None or encoding_to_compare is None:
            return False
        distance = np.linalg.norm(known_encoding - encoding_to_compare)
        return distance < tolerance


face_recognition = FaceRecognition()
